import { DATA_TTL_SECONDS } from "@/lib/cache";
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
 * SWE-bench — https://www.swebench.com/
 *
 * The site ships every split as one JSON blob inside
 * `<script id="leaderboard-data">`, which the page's own JS then renders. That
 * is a real JSON document rather than markup, so we locate the script by its
 * id and `JSON.parse` the contents — no structural regex over HTML.
 *
 * We take the **Bash Only** split, not Verified. Verified is dominated by
 * unverified self-submissions running bespoke scaffolds, several of them
 * multi-attempt, so it ranks agent products rather than models. Bash Only
 * holds one mini-SWE-agent scaffold constant across every entry, which is why
 * the maintainers made it the default view.
 *
 * Parse anchors, weakest first:
 *   1. `id="leaderboard-data"` — a stable, semantic hook the site chose for
 *      exactly this purpose. Survives restyling; dies if they move to an API.
 *   2. Split named `bash-only` in the top-level array. If they rename the
 *      split we fail loudly rather than silently falling back to Verified.
 *   3. Row keys `name` / `resolved` / `date`. Their data model, likely stable.
 */

const SOURCE_ID = "swe-bench";
const PAGE_URL = "https://www.swebench.com/";
const SPLIT = "bash-only";
const USER_AGENT =
  "tech-trends-dashboard/1.0 (leaderboard aggregator; +https://www.swebench.com/)";

/** Bash Only carried ~47 rows when this was written; below this is breakage. */
const MIN_ENTRIES = 10;

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
 * @/lib/model-match; what is SWE-bench's own is the shape of its names.
 *
 * It writes "Claude 4.5 Opus (high)": the effort lives in a trailing
 * parenthetical, and the version sits before the tier word rather than after
 * it. So parentheticals are stripped, and the shared order-insensitive key
 * makes "Claude 4.5 Opus" and the catalog's "Claude Opus 4.5" the same key
 * without any similarity scoring.
 * ---------------------------------------------------------------------- */

const tokenize = makeTokenizer({ stripParentheticals: true });

/* ---------------------------------------------------------------------- */

/** The JSON the page embeds for its own renderer. */
function extractEmbeddedJson(html: string): unknown {
  const open = html.search(
    /<script\b[^>]*\bid=["']leaderboard-data["'][^>]*>/i,
  );
  if (open < 0) return undefined;
  const bodyStart = html.indexOf(">", open) + 1;
  const bodyEnd = html.indexOf("</script>", bodyStart);
  if (bodyStart <= 0 || bodyEnd < 0) return undefined;
  return JSON.parse(html.slice(bodyStart, bodyEnd));
}

export async function fetch_swebench(): Promise<LeaderboardResult> {
  let html: string;
  try {
    const res = await fetch(PAGE_URL, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      next: { revalidate: DATA_TTL_SECONDS },
    });
    if (!res.ok) {
      return fallbackResult(
        SOURCE_ID,
        `swebench.com returned HTTP ${res.status} ${res.statusText}.`,
      );
    }
    html = await res.text();
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return fallbackResult(
      SOURCE_ID,
      `Could not reach swebench.com — ${reason}.`,
    );
  }

  try {
    let splits: unknown;
    try {
      splits = extractEmbeddedJson(html);
    } catch {
      return fallbackResult(
        SOURCE_ID,
        'The <script id="leaderboard-data"> block on swebench.com is no longer valid JSON.',
      );
    }
    if (splits === undefined) {
      return fallbackResult(
        SOURCE_ID,
        'Could not find the <script id="leaderboard-data"> block — swebench.com markup may have changed.',
      );
    }
    if (!Array.isArray(splits)) {
      return fallbackResult(
        SOURCE_ID,
        "swebench.com's embedded leaderboard data is no longer a list of splits.",
      );
    }

    const split = splits
      .map(asRecord)
      .find((s) => s !== null && asNonEmptyString(s.name) === SPLIT);
    if (!split) {
      // Deliberately no silent substitution: Verified measures something else.
      return fallbackResult(
        SOURCE_ID,
        `swebench.com no longer publishes a "${SPLIT}" split — the other splits are not comparable, so nothing was substituted.`,
      );
    }
    const rows = split.results;
    if (!Array.isArray(rows)) {
      return fallbackResult(
        SOURCE_ID,
        `The "${SPLIT}" split on swebench.com no longer carries a results list.`,
      );
    }

    const index = await buildTokenIndex(tokenize);
    const parsed: { name: string; resolved: number; date: string | null }[] = [];
    for (const raw of rows) {
      const row = asRecord(raw);
      if (!row) {
        return fallbackResult(
          SOURCE_ID,
          `A row in the "${SPLIT}" split is not an object — swebench.com's data shape has changed.`,
        );
      }
      const name = asNonEmptyString(row.name);
      const resolved = asFiniteNumber(row.resolved);
      if (!name || resolved === null) {
        return fallbackResult(
          SOURCE_ID,
          `A row in the "${SPLIT}" split is missing its name or resolved rate — swebench.com's data shape has changed.`,
        );
      }
      if (resolved < 0 || resolved > 100) {
        return fallbackResult(
          SOURCE_ID,
          `A resolved rate of ${resolved} on swebench.com is not a percentage — the column may have changed units.`,
        );
      }
      parsed.push({ name, resolved, date: asNonEmptyString(row.date) });
    }

    if (parsed.length < MIN_ENTRIES) {
      return fallbackResult(
        SOURCE_ID,
        `Only ${parsed.length} rows parsed out of the "${SPLIT}" split; expected at least ${MIN_ENTRIES}.`,
      );
    }

    // The site ships the split unsorted; rank is ours to assign. Ties share a
    // rank, as they do upstream.
    parsed.sort(
      (a, b) => b.resolved - a.resolved || a.name.localeCompare(b.name),
    );
    const entries: LeaderboardEntry[] = [];
    for (const [i, row] of parsed.entries()) {
      // Equal resolved rates share a rank; the next distinct score resumes at
      // the row's ordinal position, as a leaderboard normally numbers ties.
      const tied = i > 0 && parsed[i - 1].resolved === row.resolved;
      entries.push({
        rank: tied ? entries[i - 1].rank : i + 1,
        modelId: matchByTokens(index, row.name),
        modelName: row.name,
        score: row.resolved,
      });
    }

    // The site states no "last updated" anywhere, so the best honest proxy is
    // the most recent submission date carried by the rows themselves.
    const dates = parsed
      .map((r) => r.date)
      .filter((d): d is string => !!d && Number.isFinite(Date.parse(d)))
      .sort();
    const upstreamUpdatedAt = dates.length
      ? new Date(dates[dates.length - 1]).toISOString()
      : null;

    const board: Leaderboard = {
      id: "swe-bench-bash-only",
      name: "SWE-bench — Bash Only",
      url: PAGE_URL,
      updatedAt: upstreamUpdatedAt ?? new Date().toISOString(),
      entries,
    };
    return liveResult(SOURCE_ID, [board], upstreamUpdatedAt);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return fallbackResult(
      SOURCE_ID,
      `Could not read the SWE-bench payload — ${reason}.`,
    );
  }
}
