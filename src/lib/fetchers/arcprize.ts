import { DATA_TTL_SECONDS } from "@/lib/cache";
import {
  buildSlugIndex,
  lookupSlug,
  normalizeSlug,
  type SlugIndex,
} from "@/lib/model-match";
import { fallbackResult, liveResult } from "@/lib/snapshot";
import type { Leaderboard, LeaderboardEntry, LeaderboardResult } from "@/lib/types";

const SOURCE_ID = "arc-prize";
const PAGE_URL = "https://arcprize.org/leaderboard";
const USER_AGENT =
  "tech-trends-dashboard/1.0 (leaderboard aggregator; +https://arcprize.org/leaderboard)";

/** Longest boards get truncated so the committed snapshot stays a sane size. */
const MAX_ENTRIES = 50;

interface BoardSpec {
  /** The published asset. */
  version: "v2" | "v3";
  boardId: string;
  boardName: string;
}

const BOARDS: readonly BoardSpec[] = [
  { version: "v2", boardId: "arc-agi-2", boardName: "ARC-AGI-2 (semi-private)" },
  { version: "v3", boardId: "arc-agi-3", boardName: "ARC-AGI-3 (semi-private)" },
];

/**
 * One evaluation row. v2 names the cost column `costPerTask` and v3 names it
 * `cost`; both are USD per task, so both are read.
 */
interface Evaluation {
  modelDisplayName: string;
  score: number;
  costPerTask: number | null;
  providerDisplayName: string | null;
  modelGroup: string | null;
  display: boolean;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function toEvaluation(value: unknown): Evaluation | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const name = asString(row.modelDisplayName);
  const score = asFiniteNumber(row.score);
  if (name === null || score === null) return null;
  return {
    modelDisplayName: name,
    score,
    costPerTask: asFiniteNumber(row.costPerTask) ?? asFiniteNumber(row.cost),
    providerDisplayName: asString(row.providerDisplayName),
    modelGroup: asString(row.modelGroup),
    // Rows ARC hides on its own site (superseded configurations) stay hidden
    // here; only an explicit `false` excludes a row.
    display: row.display !== false,
  };
}

/** The reference row is a panel of people, and must never rank as a model. */
function isHumanBaseline(row: Evaluation): boolean {
  return (
    row.providerDisplayName?.toLowerCase() === "human" ||
    row.modelGroup?.toLowerCase() === "human"
  );
}

/** Vendor words ARC prefixes onto some display names. */
const VENDOR_PREFIXES = new Set([
  "anthropic",
  "openai",
  "google",
  "xai",
  "x-ai",
  "deepseek",
  "meta",
  "mistral",
  "moonshot",
  "alibaba",
  "qwen",
  "z-ai",
]);

/**
 * ARC display names look like "Claude Opus 5 (Max)" or "Anthropic Opus 4.6
 * (Max)" — a model plus a reasoning-effort setting. The effort suffix is
 * dropped and the remainder must match the catalog exactly; Anthropic rows
 * are additionally tried with the `claude-` family prefix ARC omits. Anything
 * that does not land on an exact id stays unmapped.
 */
function resolveModelId(row: Evaluation, index: SlugIndex): string | null {
  const base = row.modelDisplayName.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const slug = normalizeSlug(base);

  const candidates = [slug];
  const [head, ...rest] = slug.split("-");
  if (rest.length > 0 && VENDOR_PREFIXES.has(head)) {
    const trimmed = rest.join("-");
    candidates.push(trimmed);
    if (head === "anthropic") candidates.push(`claude-${trimmed}`);
  } else if (row.providerDisplayName?.toLowerCase() === "anthropic") {
    candidates.push(`claude-${slug}`);
  }

  for (const candidate of candidates) {
    const hit = lookupSlug(index, candidate);
    if (hit) return hit;
  }
  return null;
}

async function fetchBoard(
  spec: BoardSpec,
): Promise<{ generatedAt: string | null; rows: Evaluation[] } | string> {
  const url = `https://arcprize.org/media/data/leaderboard/${spec.version}.json`;
  let payload: unknown;
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      next: { revalidate: DATA_TTL_SECONDS },
    });
    if (!response.ok) {
      return `ARC Prize ${spec.version}.json returned HTTP ${response.status}.`;
    }
    payload = await response.json();
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return `Could not reach ARC Prize ${spec.version}.json: ${reason}`;
  }

  if (typeof payload !== "object" || payload === null) {
    return `ARC Prize ${spec.version}.json was not a JSON object.`;
  }
  const raw = (payload as { evaluations?: unknown }).evaluations;
  if (!Array.isArray(raw)) {
    return `ARC Prize ${spec.version}.json is missing its \`evaluations\` array.`;
  }

  const rows = raw
    .map(toEvaluation)
    .filter((row): row is Evaluation => row !== null && row.display);
  if (rows.length === 0) {
    return `ARC Prize ${spec.version}.json yielded no usable evaluation rows.`;
  }

  return {
    generatedAt: asString((payload as { generatedAt?: unknown }).generatedAt),
    rows,
  };
}

export async function fetch_arcprize(): Promise<LeaderboardResult> {
  try {
    const index = await buildSlugIndex();
    const settled = await Promise.all(BOARDS.map(fetchBoard));

    const boards: Leaderboard[] = [];
    const failures: string[] = [];
    let upstreamUpdatedAt: string | null = null;

    settled.forEach((outcome, i) => {
      const spec = BOARDS[i];
      if (typeof outcome === "string") {
        failures.push(outcome);
        return;
      }
      if (outcome.generatedAt && !upstreamUpdatedAt) {
        upstreamUpdatedAt = outcome.generatedAt;
      }

      const entries: LeaderboardEntry[] = [...outcome.rows]
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_ENTRIES)
        .map((row, rank) => {
          const human = isHumanBaseline(row);
          return {
            rank: rank + 1,
            modelId: human ? null : resolveModelId(row, index),
            modelName: human
              ? `${row.modelDisplayName} — human baseline, not a model`
              : row.modelDisplayName,
            // The payload scores 0..1; the board's unit is a percentage.
            // Rounded only to drop float noise (0.3016 * 100), not precision.
            score: Math.round(row.score * 1e6) / 1e4,
            costPerTask: row.costPerTask,
          };
        });

      boards.push({
        id: spec.boardId,
        name: spec.boardName,
        url: PAGE_URL,
        updatedAt: outcome.generatedAt ?? new Date().toISOString(),
        entries,
      });
    });

    // Both assets come from one host and share a generatedAt, so a partial
    // result is a sign something is wrong upstream rather than a board being
    // legitimately absent. Show the last known good pair instead of half of
    // a live one.
    if (failures.length > 0 || boards.length !== BOARDS.length) {
      return fallbackResult(
        SOURCE_ID,
        failures.join(" ") || "ARC Prize returned no usable boards.",
      );
    }

    return liveResult(SOURCE_ID, boards, upstreamUpdatedAt);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return fallbackResult(
      SOURCE_ID,
      `Could not parse the ARC Prize leaderboard data: ${reason}`,
    );
  }
}
