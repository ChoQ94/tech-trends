import {
  buildTokenIndex,
  makeTokenizer,
  matchByTokens,
} from "@/lib/model-match";
import { fallbackResult, liveResult } from "@/lib/snapshot";
import type {
  Leaderboard,
  LeaderboardEntry,
  LeaderboardResult,
} from "@/lib/types";

/**
 * Scale — SWE-bench Pro
 * https://labs.scale.com/leaderboard/swe_bench_pro_public
 * (scale.com/leaderboard/* 308-redirects to labs.scale.com.)
 *
 * The table itself is client-rendered — there is no <table> in the delivered
 * HTML — but the rows are handed to that component as props, and Next.js
 * serialises props into the RSC flight payload embedded in the page. So we
 * reassemble the payload and read the JSON array rather than parsing markup.
 *
 * Parse anchors, weakest first:
 *   1. `self.__next_f.push([...])` — the App Router flight transport.
 *   2. `"entries":[` immediately followed by objects carrying `model`, `rank`
 *      and `score`. This is a component prop name, so it is the most fragile
 *      link: a rename during a refactor would break it with no visible cause
 *      on the site. Guarded by requiring the row keys to match too, so we
 *      cannot latch onto some unrelated `entries` array.
 *   3. Row keys `model` / `rank` / `score` / `createdAt` — Scale's data
 *      model, the most durable part. (Rows also carry a ± confidence
 *      interval, which this dashboard's entry shape has nowhere to put.)
 *
 * Both splits are taken. The private split is drawn from proprietary
 * codebases and is the contamination-resistant one, so it is worth the extra
 * request; it is treated as best-effort, because losing it should not also
 * cost the reader the public board.
 */

const SOURCE_ID = "scale-swe-bench-pro";
const USER_AGENT =
  "tech-trends-dashboard/1.0 (leaderboard aggregator; +https://labs.scale.com/)";

interface BoardSpec {
  id: string;
  name: string;
  url: string;
  minEntries: number;
}

const PUBLIC_BOARD: BoardSpec = {
  id: "scale-swe-bench-pro-public",
  name: "SWE-bench Pro — public split",
  url: "https://labs.scale.com/leaderboard/swe_bench_pro_public",
  minEntries: 5,
};

const PRIVATE_BOARD: BoardSpec = {
  id: "scale-swe-bench-pro-private",
  name: "SWE-bench Pro — private split",
  url: "https://labs.scale.com/leaderboard/swe_bench_pro_private",
  minEntries: 5,
};

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

/* -------------------------------------------------------------------------
 * Model identification. The shared exact-match rules live in
 * @/lib/model-match; what is Scale's own is that it mixes naming styles in
 * one table ("claude-opus-4-6 (thinking)*", "Opus 4.5", "Claude Opus 4.1",
 * "gpt-5.4 (xHigh)*"), so parentheticals are stripped and the shared key is
 * order-insensitive. Anything that does not land on exactly one catalog model
 * stays null and keeps its raw name — including dated build ids like
 * "claude-opus-4-5-20251101", which we do not attempt to resolve.
 * ---------------------------------------------------------------------- */

const tokenize = makeTokenizer({ stripParentheticals: true });

/* ---------------------------------------------------------------------- */

/** Reassemble the RSC flight payload from the inline script chunks. */
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
 * that brackets inside model names or prose do not throw off the depth count.
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

interface ScaleRow {
  model: string;
  rank: number;
  score: number;
  createdAt: string | null;
}

/** A row only counts if every field we rely on is there and in range. */
function readRow(raw: unknown): ScaleRow | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const model = asNonEmptyString(rec.model);
  const rank = asFiniteNumber(rec.rank);
  const score = asFiniteNumber(rec.score);
  if (!model || rank === null || score === null) return null;
  // The column is a resolve rate; anything outside 0..100 is a different
  // column, not a surprising result.
  if (score < 0 || score > 100 || rank < 1) return null;
  return {
    model,
    rank,
    score,
    createdAt: asNonEmptyString(rec.createdAt),
  };
}

/**
 * The first `"entries":[…]` array in the payload whose rows actually read as
 * leaderboard rows. Requiring the row shape keeps us from latching onto some
 * unrelated array that happens to share the prop name.
 */
function findRows(payload: string): ScaleRow[] | null {
  const marker = '"entries":';
  let from = 0;
  for (;;) {
    const at = payload.indexOf(marker, from);
    if (at < 0) return null;
    from = at + marker.length;
    const slice = sliceJsonValue(payload, at + marker.length);
    if (!slice) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(slice);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) continue;
    const rows = parsed.map(readRow);
    if (rows.every((r): r is ScaleRow => r !== null)) return rows;
  }
}

interface ParsedBoard {
  board: Leaderboard;
  updatedAt: string | null;
}

type BoardOutcome = { ok: true; value: ParsedBoard } | { ok: false; why: string };

async function parseBoard(
  spec: BoardSpec,
  html: string,
): Promise<BoardOutcome> {
  const payload = rscPayload(html);
  if (!payload) {
    return {
      ok: false,
      why: `no Next.js RSC payload on ${spec.url}`,
    };
  }
  const rows = findRows(payload);
  if (!rows) {
    return {
      ok: false,
      why: `could not find the embedded leaderboard rows on ${spec.url}`,
    };
  }
  if (rows.length < spec.minEntries) {
    return {
      ok: false,
      why: `only ${rows.length} rows on ${spec.url}, expected at least ${spec.minEntries}`,
    };
  }

  const index = await buildTokenIndex(tokenize);
  const entries: LeaderboardEntry[] = rows.map((row) => ({
    rank: row.rank,
    // Some names carry a trailing "*". Scale publishes no legend for it on
    // these pages, so we keep the mark verbatim rather than inventing a
    // meaning for it or dropping information the reader can check upstream.
    modelId: matchByTokens(index, row.model),
    modelName: row.model,
    score: row.score,
  }));

  // The page states no "last updated" of its own, so the newest row's
  // createdAt is the closest honest thing — the date of the latest submission,
  // not of the last page edit.
  const dates = rows
    .map((r) => r.createdAt)
    .filter((d): d is string => !!d && Number.isFinite(Date.parse(d)))
    .sort();
  const updatedAt = dates.length
    ? new Date(dates[dates.length - 1]).toISOString()
    : null;

  return {
    ok: true,
    value: {
      updatedAt,
      board: {
        id: spec.id,
        name: spec.name,
        url: spec.url,
        updatedAt: updatedAt ?? new Date().toISOString(),
        entries,
      },
    },
  };
}

async function loadBoard(spec: BoardSpec): Promise<BoardOutcome> {
  let html: string;
  try {
    const res = await fetch(spec.url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return { ok: false, why: `${spec.url} returned HTTP ${res.status}` };
    }
    html = await res.text();
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return { ok: false, why: `could not reach ${spec.url} (${reason})` };
  }
  try {
    return await parseBoard(spec, html);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return { ok: false, why: `could not read ${spec.url} (${reason})` };
  }
}

export async function fetch_scale(): Promise<LeaderboardResult> {
  const [pub, priv] = await Promise.all([
    loadBoard(PUBLIC_BOARD),
    loadBoard(PRIVATE_BOARD),
  ]);

  // The public split is the headline board: without it there is nothing to
  // show and we go stale. The private split is best-effort — it is a second
  // page that may be retired independently, and losing it should not also
  // cost the reader the public numbers. Its absence is visible as a missing
  // board rather than as wrong numbers.
  if (!pub.ok) {
    return fallbackResult(
      SOURCE_ID,
      `Could not read the SWE-bench Pro public leaderboard — ${pub.why}. labs.scale.com markup may have changed.`,
    );
  }

  const parsed = priv.ok ? [pub.value, priv.value] : [pub.value];
  const dates = parsed
    .map((p) => p.updatedAt)
    .filter((d): d is string => !!d)
    .sort();

  return liveResult(
    SOURCE_ID,
    parsed.map((p) => p.board),
    dates.length ? dates[dates.length - 1] : null,
  );
}
