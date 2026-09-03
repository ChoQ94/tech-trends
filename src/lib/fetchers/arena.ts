import { DATA_TTL_SECONDS } from "@/lib/cache";
import {
  buildTokenIndex,
  lookupTokens,
  makeTokenizer,
  type TokenIndex,
} from "@/lib/model-match";
import { fallbackResult, liveResult } from "@/lib/snapshot";
import type {
  Leaderboard,
  LeaderboardEntry,
  LeaderboardResult,
} from "@/lib/types";

/**
 * Arena, formerly LMArena — https://arena.ai/leaderboard/...
 * (lmarena.ai 301-redirects here.)
 *
 * The only genuinely HTML-only source here: the boards are server-rendered
 * into a real <table> and the numbers appear nowhere in the RSC payload, which
 * carries only the model catalog. So this one does parse markup — but it is
 * anchored on semantics rather than structure:
 *
 *   1. The single <table> on the page, split into <thead>/<tbody>.
 *   2. Column position is resolved from the <th> TEXT ("Score", "Votes",
 *      "Net Improvement"), never from a hard-coded index. Arena reorders and
 *      adds columns between boards — the Agent board has twelve to Text's
 *      seven — so reading headers is the only thing that keeps this honest,
 *      and it survives a column being inserted.
 *   3. The board date is the first "Mon D, YYYY" the page renders, which sits
 *      in the summary line above the table.
 *
 * Every class name in this markup is Tailwind and will churn on any restyle,
 * so nothing here keys on one. What would break this file is Arena moving the
 * table to client-side rendering, or dropping the <th> labels.
 *
 * Known limitation, stated rather than faked: the category sub-filters
 * (Text -> Coding, and so on) are applied CLIENT-side, and the URL parameter
 * does not change the server-rendered table. We therefore publish only each
 * board's default overall view, and no sub-category is synthesised.
 */

const SOURCE_ID = "arena";
const USER_AGENT =
  "tech-trends-dashboard/1.0 (leaderboard aggregator; +https://arena.ai/)";

interface BoardSpec {
  id: string;
  name: string;
  url: string;
  /** The <th> label of the column holding the ranked metric. */
  scoreHeader: string;
  /** Sanity range for that metric; outside it we assume a column moved. */
  min: number;
  max: number;
  /** Below this many rows the board is presumed broken, not merely small. */
  minEntries: number;
}

/**
 * Note the Agent board's metric is Net Improvement %, not Elo — a different
 * unit entirely. It is kept as its own board so the two are never mixed.
 */
const BOARDS: readonly BoardSpec[] = [
  {
    id: "arena-text",
    name: "Arena — Text (Overall)",
    url: "https://arena.ai/leaderboard/text",
    scoreHeader: "score",
    min: 500,
    max: 3000,
    minEntries: 20,
  },
  {
    id: "arena-webdev",
    name: "Arena — WebDev (Overall)",
    url: "https://arena.ai/leaderboard/code/webdev",
    scoreHeader: "score",
    min: 500,
    max: 3000,
    minEntries: 20,
  },
  {
    id: "arena-agent",
    name: "Arena — Agent (Net Improvement)",
    url: "https://arena.ai/leaderboard/agent",
    scoreHeader: "net improvement",
    min: -100,
    max: 100,
    minEntries: 10,
  },
] as const;

/* -------------------------------------------------------------------------
 * Model identification. The shared exact-match rules live in
 * @/lib/model-match; the effort-word retry below is Arena's own.
 * ---------------------------------------------------------------------- */

const EFFORT_WORDS = new Set([
  "high",
  "xhigh",
  "medium",
  "low",
  "minimal",
  "max",
  "thinking",
  "nonthinking",
  "reasoning",
]);

const tokenize = makeTokenizer({ stripParentheticals: true });

function withoutTrailingEffort(parts: string[]): string[] {
  const out = [...parts];
  while (out.length > 1 && EFFORT_WORDS.has(out[out.length - 1])) out.pop();
  return out;
}

/**
 * The name as given first; only if that matches nothing do we retry with the
 * trailing effort word removed. That ordering is the whole point: it keeps a
 * model genuinely named "…-Max" (Qwen3.8-Max) from being stripped down to
 * something else.
 */
function matchModelId(rawName: string, index: TokenIndex): string | null {
  const parts = index.tokenize(rawName);
  return lookupTokens(index, parts) ?? lookupTokens(index, withoutTrailingEffort(parts));
}

/* -------------------------------------------------------------------------
 * Markup readers. Kept as shallow as possible.
 * ---------------------------------------------------------------------- */

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = body.startsWith("#x") || body.startsWith("#X")
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return HTML_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Visible text of a markup fragment, whitespace-collapsed. */
function textOf(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function section(html: string, tag: "thead" | "tbody"): string | null {
  const open = html.indexOf(`<${tag}`);
  if (open < 0) return null;
  const close = html.indexOf(`</${tag}>`, open);
  if (close < 0) return null;
  return html.slice(open, close);
}

function cellsOf(row: string, tag: "th" | "td"): string[] {
  return [...row.matchAll(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "g"))].map(
    (m) => m[0],
  );
}

/** The first "Mon D, YYYY" the page renders — Arena's own board date. */
function boardDate(html: string): string | null {
  const m = html.match(/>\s*([A-Z][a-z]{2} \d{1,2}, \d{4})\s*</);
  if (!m) return null;
  const ms = Date.parse(`${m[1]} UTC`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * The leading number in a cell like "1507 ±5" or "13.88 % ±1.83%". The score
 * and its interval share one cell; only the point estimate is a number we can
 * put in `score`, and the interval is deliberately not smuggled into it.
 */
function leadingNumber(cell: string): number | null {
  const m = cell.match(/^-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number.parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

interface ParsedBoard {
  board: Leaderboard;
  updatedAt: string | null;
}

/** Either the parsed board, or the reason it could not be parsed. */
type BoardOutcome = { ok: true; value: ParsedBoard } | { ok: false; why: string };

function parseBoard(
  spec: BoardSpec,
  html: string,
  index: TokenIndex,
): BoardOutcome {
  const head = section(html, "thead");
  const body = section(html, "tbody");
  if (!head || !body) {
    return { ok: false, why: `${spec.url}에 리더보드 표가 없습니다` };
  }

  const headers = cellsOf(head, "th").map((c) => textOf(c).toLowerCase());
  const modelCol = headers.indexOf("model");
  const scoreCol = headers.indexOf(spec.scoreHeader);
  // Arena's own rank is authoritative where it exists (it is what would show
  // ties); position in the table is only the fallback.
  const rankCol = headers.indexOf("rank");
  if (modelCol < 0 || scoreCol < 0) {
    return {
      ok: false,
      why: `${spec.url}에 더 이상 "Model"과 "${spec.scoreHeader}" 열이 없습니다 (발견된 열: ${headers.join(", ") || "없음"})`,
    };
  }

  const rows = [...body.matchAll(/<tr\b[\s\S]*?<\/tr>/g)].map((m) => m[0]);
  const entries: LeaderboardEntry[] = [];
  for (const row of rows) {
    const cells = cellsOf(row, "td");
    if (cells.length !== headers.length) {
      return {
        ok: false,
        why: `${spec.url}의 한 행에 헤더 ${headers.length}개에 대해 셀이 ${cells.length}개입니다`,
      };
    }

    // The model cell nests the model id in a title attribute; that is the
    // cleanest handle on it, since the visible text also carries the lab name,
    // the licence and any badge. Fall back to the cell's own text.
    const modelCell = cells[modelCol];
    const titled = modelCell.match(/\btitle="([^"]+)"/);
    const rawName = titled ? decodeEntities(titled[1]).trim() : "";
    if (!rawName) {
      return { ok: false, why: `${spec.url}의 한 행에 모델 이름이 없습니다` };
    }

    const score = leadingNumber(textOf(cells[scoreCol]));
    if (score === null || score < spec.min || score > spec.max) {
      return {
        ok: false,
        why: `${spec.url}의 "${rawName}"에 읽을 수 없거나 범위를 벗어난 ${spec.scoreHeader} 값이 있습니다 (${textOf(cells[scoreCol]) || "비어 있음"})`,
      };
    }

    // Arena badges low-vote rows "Preliminary". Carrying the flag into the
    // name is the only way this data model can say so — a preliminary entry
    // must never be presented as settled.
    const preliminary = /\bPreliminary\b/i.test(textOf(modelCell));

    const upstreamRank =
      rankCol >= 0 ? leadingNumber(textOf(cells[rankCol])) : null;

    entries.push({
      rank: upstreamRank ?? entries.length + 1,
      modelId: matchModelId(rawName, index),
      modelName: preliminary ? `${rawName} — preliminary` : rawName,
      score,
    });
  }

  if (entries.length < spec.minEntries) {
    return {
      ok: false,
      why: `${spec.url}에서 ${entries.length}행만 해석했습니다. 최소 ${spec.minEntries}행을 기대했습니다`,
    };
  }

  const updatedAt = boardDate(html);
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

async function loadBoard(
  spec: BoardSpec,
  index: TokenIndex,
): Promise<BoardOutcome> {
  let html: string;
  try {
    const res = await fetch(spec.url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      next: { revalidate: DATA_TTL_SECONDS },
    });
    if (!res.ok) {
      return { ok: false, why: `${spec.url}이(가) HTTP ${res.status}을(를) 반환했습니다` };
    }
    html = await res.text();
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return { ok: false, why: `${spec.url}에 연결하지 못했습니다 (${reason})` };
  }
  try {
    return parseBoard(spec, html, index);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return { ok: false, why: `${spec.url}을(를) 읽지 못했습니다 (${reason})` };
  }
}

export async function fetch_arena(): Promise<LeaderboardResult> {
  // Built from the catalog verbatim — never effort-stripped — so a model whose
  // real name ends in an effort word keeps its own key.
  const index = await buildTokenIndex(tokenize);
  const outcomes = await Promise.all(
    BOARDS.map((spec) => loadBoard(spec, index)),
  );

  // All three boards come off the same renderer, so one failing almost always
  // means the markup moved. We publish all three or none: a board quietly
  // vanishing from the page would be exactly the silent breakage this is
  // meant to avoid.
  const failures = outcomes
    .filter((o): o is { ok: false; why: string } => !o.ok)
    .map((o) => o.why);
  if (failures.length) {
    return fallbackResult(
      SOURCE_ID,
      `Arena 리더보드 표를 읽지 못했습니다 — ${failures.join("; ")}. arena.ai 마크업이 바뀌었을 수 있습니다.`,
    );
  }

  const parsed = outcomes
    .filter((o): o is { ok: true; value: ParsedBoard } => o.ok)
    .map((o) => o.value);

  // Each board states its own date; the newest is the source's freshness.
  const dates = parsed
    .map((p) => p.updatedAt)
    .filter((d): d is string => !!d)
    .sort();
  const upstreamUpdatedAt = dates.length ? dates[dates.length - 1] : null;

  return liveResult(
    SOURCE_ID,
    parsed.map((p) => p.board),
    upstreamUpdatedAt,
  );
}
