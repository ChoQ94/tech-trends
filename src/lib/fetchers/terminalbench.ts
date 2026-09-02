import { DATA_TTL_SECONDS } from "@/lib/cache";
import {
  buildTokenIndex,
  makeTokenizer,
  matchByTokens,
  type TokenIndex,
} from "@/lib/model-match";
import { fallbackResult, liveResult } from "@/lib/snapshot";
import type {
  Leaderboard,
  LeaderboardEntry,
  LeaderboardResult,
} from "@/lib/types";

/**
 * Terminal-Bench — https://www.tbench.ai/
 *
 * tbench publishes no API. The board is rendered from a TanStack Query cache
 * that Next.js dehydrates into the RSC flight payload embedded in the page,
 * so we reassemble that payload and read the query's data object out of it.
 *
 * Parse anchors, weakest first:
 *   1. `self.__next_f.push([...])` — the Next.js App Router flight transport.
 *      Stable across Next minor versions; would break on a move off the App
 *      Router or onto a different streaming transport.
 *   2. `"data":{"leaderboard":` — the shape of one dehydrated query. Breaks if
 *      tbench stops prefetching the board on the server.
 *   3. `package === "terminal-bench/terminal-bench"` and the `rows[].metrics`
 *      keys. These are tbench's own data model, not presentation, so they are
 *      the most likely part of this file to survive a redesign.
 *
 * If any of that stops matching we return the snapshot and say so, rather than
 * emitting whatever half-shaped rows we managed to scrape.
 */

const SOURCE_ID = "terminal-bench";
const PAGE_URL = "https://www.tbench.ai/";
const PACKAGE = "terminal-bench/terminal-bench";
const USER_AGENT =
  "tech-trends-dashboard/1.0 (leaderboard aggregator; +https://www.tbench.ai/)";

/** A board with fewer rows than this is not a board we should publish. */
const MIN_ENTRIES = 5;

/* -------------------------------------------------------------------------
 * Narrowing helpers. The payload is `unknown` and stays that way until each
 * field has been checked, so a shape change surfaces as a clean fallback.
 * ---------------------------------------------------------------------- */

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asFiniteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** The `label` of a `{ url, label }` link object, as tbench nests them. */
function linkLabel(v: unknown): string | null {
  const rec = asRecord(v);
  return rec ? asNonEmptyString(rec.label) : null;
}

/**
 * Reassemble the RSC flight payload from the inline script chunks. Each chunk
 * is `self.__next_f.push([1, "<flight text>"])`; the text pieces concatenate
 * into one stream.
 */
function rscPayload(html: string): string {
  const chunks: string[] = [];
  const re = /self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g;
  for (const m of html.matchAll(re)) {
    try {
      const parsed: unknown = JSON.parse(m[1]);
      if (!Array.isArray(parsed)) continue;
      const tail: unknown = parsed[parsed.length - 1];
      if (typeof tail === "string") chunks.push(tail);
    } catch {
      // A chunk we cannot decode simply contributes nothing.
    }
  }
  return chunks.join("");
}

/**
 * The JSON value beginning at `start`, brace-matched with string awareness so
 * that braces inside model names or prose do not throw off the depth count.
 */
function sliceJsonValue(text: string, start: number): string | null {
  const open = text[start];
  if (open !== "{" && open !== "[") return null;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/** Every dehydrated `{ leaderboard, rows }` payload present in the page. */
function extractBoardPayloads(payload: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const marker = '"data":{"leaderboard":';
  let from = 0;
  for (;;) {
    const at = payload.indexOf(marker, from);
    if (at < 0) break;
    from = at + marker.length;
    const objectStart = at + '"data":'.length;
    const slice = sliceJsonValue(payload, objectStart);
    if (!slice) continue;
    try {
      const rec = asRecord(JSON.parse(slice));
      if (rec) out.push(rec);
    } catch {
      // Not a complete object at this offset; keep scanning.
    }
  }
  return out;
}

/** "4-0-0" -> [4, 0, 0], so the newest board wins if several are embedded. */
function versionParts(name: string): number[] {
  return name.split(/[.\-_]/).map((p) => Number.parseInt(p, 10) || 0);
}

function compareVersions(a: string, b: string): number {
  const av = versionParts(a);
  const bv = versionParts(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const d = (av[i] ?? 0) - (bv[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/* -------------------------------------------------------------------------
 * Model identification. The shared rules — exact match only, a key claimed by
 * two models resolving to null, and the name-minus-leading-word secondary key
 * that lets tbench's short names ("Opus 5") land — live in @/lib/model-match.
 * tbench prints no parenthetical markers, so nothing is stripped here.
 * ---------------------------------------------------------------------- */

const tokenize = makeTokenizer();

/* ---------------------------------------------------------------------- */

interface ParsedBoard {
  board: Leaderboard;
  /** The upstream version string, e.g. "4-0-0", used to pick the newest. */
  version: string;
  updatedAt: string | null;
}

function parseBoard(
  data: Record<string, unknown>,
  index: TokenIndex,
): ParsedBoard | null {
  const meta = asRecord(data.leaderboard);
  const rawRows = data.rows;
  if (!meta || !Array.isArray(rawRows)) return null;
  if (asNonEmptyString(meta.package) !== PACKAGE) return null;

  const version = asNonEmptyString(meta.name);
  if (!version) return null;
  // Upstream ships microsecond precision and a "+00:00" offset; normalise so
  // every source in this dashboard reports one date format.
  const rawUpdatedAt = asNonEmptyString(meta.updated_at);
  const updatedMs = rawUpdatedAt ? Date.parse(rawUpdatedAt) : NaN;
  const updatedAt = Number.isFinite(updatedMs)
    ? new Date(updatedMs).toISOString()
    : null;

  const entries: LeaderboardEntry[] = [];
  for (const raw of rawRows) {
    const row = asRecord(raw);
    if (!row) return null;
    const metadata = asRecord(row.metadata);
    const metrics = asRecord(row.metrics);
    if (!metadata || !metrics) return null;

    const rank = asFiniteNumber(row.rank);
    const accuracy = asFiniteNumber(metrics.accuracy);
    const trials = asFiniteNumber(metrics.n_trials);
    // The board publishes a 95% CI half-width alongside each accuracy. It is
    // load-bearing here: the gaps between adjacent rows are often smaller than
    // the intervals, so a bare ranking would imply a separation the data does
    // not support.
    const ciHalfWidth = asFiniteNumber(metrics.accuracy_ci95_half_width);
    const modelLabel = linkLabel(metadata.model_display);
    // Any row we cannot read completely means the shape moved under us.
    if (rank === null || accuracy === null || trials === null || !modelLabel) {
      return null;
    }
    // Accuracy is a percentage on this board; a value outside 0..100 means we
    // are reading some other column.
    if (accuracy < 0 || accuracy > 100 || trials <= 0) return null;

    // The agent harness is NOT held constant across rows, so model and
    // scaffold are confounded. Carry both into the display name rather than
    // presenting the number as a property of the model alone.
    const agent = linkLabel(metadata.agent_display);
    const effort = asNonEmptyString(metadata.reasoning_effort);
    const qualifiers = [agent, effort].filter((q): q is string => !!q);
    const modelName = qualifiers.length
      ? `${modelLabel} (${qualifiers.join(", ")})`
      : modelLabel;

    entries.push({
      rank,
      modelId: matchByTokens(index, modelLabel),
      modelName,
      score: accuracy,
      ci:
        ciHalfWidth !== null && ciHalfWidth >= 0
          ? { low: accuracy - ciHalfWidth, high: accuracy + ciHalfWidth }
          : null,
    });
  }

  if (entries.length < MIN_ENTRIES) return null;

  // "4-0-0" -> "4-0" so the board id stays stable across patch releases.
  const majorMinor = versionParts(version).slice(0, 2).join("-");
  const display = versionParts(version).slice(0, 2).join(".");

  return {
    version,
    updatedAt,
    board: {
      id: `terminal-bench-${majorMinor}`,
      name: `Terminal-Bench ${display}`,
      url: PAGE_URL,
      updatedAt: updatedAt ?? new Date().toISOString(),
      entries,
    },
  };
}

export async function fetch_terminalbench(): Promise<LeaderboardResult> {
  let html: string;
  try {
    const res = await fetch(PAGE_URL, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      next: { revalidate: DATA_TTL_SECONDS },
    });
    if (!res.ok) {
      return fallbackResult(
        SOURCE_ID,
        `tbench.ai returned HTTP ${res.status} ${res.statusText}.`,
      );
    }
    html = await res.text();
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return fallbackResult(SOURCE_ID, `Could not reach tbench.ai — ${reason}.`);
  }

  try {
    const payload = rscPayload(html);
    if (!payload) {
      return fallbackResult(
        SOURCE_ID,
        "No Next.js RSC payload in the tbench.ai page — the site's rendering may have changed.",
      );
    }

    const index = await buildTokenIndex(tokenize);
    const parsed = extractBoardPayloads(payload)
      .map((d) => parseBoard(d, index))
      .filter((p): p is ParsedBoard => p !== null);

    if (!parsed.length) {
      return fallbackResult(
        SOURCE_ID,
        "Could not find the embedded Terminal-Bench leaderboard payload — tbench.ai markup may have changed.",
      );
    }

    // Several versions may be embedded; publish only the newest.
    parsed.sort((a, b) => compareVersions(b.version, a.version));
    const newest = parsed[0];
    return liveResult(SOURCE_ID, [newest.board], newest.updatedAt);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return fallbackResult(
      SOURCE_ID,
      `Could not read the Terminal-Bench payload — ${reason}.`,
    );
  }
}
