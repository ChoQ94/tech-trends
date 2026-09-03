import type { BadgeTone } from "@/components/ui";
import { getModelMap } from "@/lib/models";
import type {
  Benchmark,
  BenchmarkData,
  Leaderboard,
  LeaderboardEntry,
  Model,
  Score,
} from "@/lib/types";
import raw from "../../data/benchmarks.json";

const data = raw as unknown as BenchmarkData;

const benchmarks: Benchmark[] = Array.isArray(data?.benchmarks)
  ? data.benchmarks.filter(
      (b): b is Benchmark => !!b && typeof b.id === "string",
    )
  : [];

const benchmarkIds = new Set(benchmarks.map((b) => b.id));

/**
 * Rows that are structurally sound. The model end of the join is checked
 * separately, in `getScores`, because the catalog is now fetched rather than
 * imported — and every one of these `modelId`s is a former curated id, which
 * resolves only because data/model-id-map.json carries it forward as an alias.
 */
const wellFormedScores: Score[] = (
  Array.isArray(data?.scores) ? data.scores : []
).filter(
  (s): s is Score =>
    !!s &&
    typeof s.modelId === "string" &&
    benchmarkIds.has(s.benchmarkId) &&
    typeof s.score === "number" &&
    Number.isFinite(s.score),
);

const leaderboards: Leaderboard[] = (
  Array.isArray(data?.leaderboards) ? data.leaderboards : []
)
  .filter((l): l is Leaderboard => !!l && Array.isArray(l.entries))
  .map((l) => ({
    ...l,
    entries: l.entries
      .filter(
        (e): e is LeaderboardEntry =>
          !!e && typeof e.score === "number" && Number.isFinite(e.score),
      )
      .sort((a, b) => a.rank - b.rank),
  }))
  .filter((l) => l.entries.length > 0);

export function getBenchmarks(): Benchmark[] {
  return benchmarks;
}

/**
 * Scores are only kept when both ends of the join resolve: an unknown
 * modelId or benchmarkId is dropped rather than rendered as a hole.
 */
export async function getScores(): Promise<Score[]> {
  const modelMap = await getModelMap();
  return wellFormedScores.filter((s) => modelMap.has(s.modelId));
}

/** Scores whose model no longer resolves — the count the id map exists to keep at zero. */
export async function getUnjoinedScoreCount(): Promise<number> {
  const modelMap = await getModelMap();
  return wellFormedScores.filter((s) => !modelMap.has(s.modelId)).length;
}

export function getLeaderboards(): Leaderboard[] {
  return leaderboards;
}

/** The leaderboard the overview teases. */
export function getPrimaryLeaderboard(): Leaderboard | null {
  return leaderboards[0] ?? null;
}

export function getSources(): { name: string; url: string }[] {
  return Array.isArray(data?.sources) ? data.sources : [];
}

export function getUpdatedAt(): string | null {
  return typeof data?.updatedAt === "string" ? data.updatedAt : null;
}

/** min/max per benchmark, used to normalize the heat treatment. */
export async function getBenchmarkRanges(): Promise<
  Map<string, { min: number; max: number }>
> {
  const ranges = new Map<string, { min: number; max: number }>();
  for (const s of await getScores()) {
    const cur = ranges.get(s.benchmarkId);
    if (!cur) ranges.set(s.benchmarkId, { min: s.score, max: s.score });
    else {
      cur.min = Math.min(cur.min, s.score);
      cur.max = Math.max(cur.max, s.score);
    }
  }
  return ranges;
}

export interface MatrixRow {
  model: Model;
  cells: (Score | null)[];
}

export interface Matrix {
  benchmarks: Benchmark[];
  rows: MatrixRow[];
}

/**
 * Rows = every model that has at least one score, columns = every benchmark
 * that at least one model was measured on. Models are ordered by how many
 * benchmarks they cover, so the dense rows sit at the top.
 */
export async function getMatrix(): Promise<Matrix> {
  const modelMap = await getModelMap();
  const scores = await getScores();
  const cols = benchmarks.filter((b) =>
    scores.some((s) => s.benchmarkId === b.id),
  );

  const byModel = new Map<string, Map<string, Score>>();
  for (const s of scores) {
    let row = byModel.get(s.modelId);
    if (!row) {
      row = new Map<string, Score>();
      byModel.set(s.modelId, row);
    }
    row.set(s.benchmarkId, s);
  }

  const rows: MatrixRow[] = [];
  for (const [modelId, cellMap] of byModel) {
    const model = modelMap.get(modelId);
    if (!model) continue;
    rows.push({
      model,
      cells: cols.map((b) => cellMap.get(b.id) ?? null),
    });
  }

  rows.sort((a, b) => {
    const ac = a.cells.filter(Boolean).length;
    const bc = b.cells.filter(Boolean).length;
    return bc - ac || a.model.name.localeCompare(b.model.name);
  });

  return { benchmarks: cols, rows };
}

/**
 * 0..1 heat, where 1 is "best in this column". Respects higherIsBetter, and
 * returns 0.5 when a column has no spread to compare against.
 */
export function heatFor(
  score: number,
  benchmark: Benchmark,
  range: { min: number; max: number } | undefined,
): number {
  if (!range || range.max === range.min) return 0.5;
  const t = (score - range.min) / (range.max - range.min);
  return benchmark.higherIsBetter ? t : 1 - t;
}

export function getBenchmarkCount(): number {
  return benchmarks.length;
}

/* -------------------------------------------------------------------------
 * Benchmark lifecycle
 *
 * Benchmarks saturate and get retired. A score on a non-current benchmark is
 * kept for continuity, but putting it next to a current one implies a
 * comparability that does not exist — so the status has to reach the screen.
 * ---------------------------------------------------------------------- */

const benchmarkById = new Map(benchmarks.map((b) => [b.id, b]));

const EFFORT_SUFFIXES = new Set([
  "high",
  "xhigh",
  "medium",
  "low",
  "xlow",
  "max",
  "min",
  "minimal",
  "fast",
  "thinking",
  "nonthinking",
  "reasoning",
  "preview",
]);

const ACRONYMS: Record<string, string> = {
  gpt: "GPT",
  glm: "GLM",
  aa: "AA",
  ai: "AI",
  agi: "AGI",
  arc: "ARC",
  hle: "HLE",
  imo: "IMO",
  ipho: "IPhO",
  icho: "IChO",
};

function tokenize(value: string): string[] {
  return value.split(/[^A-Za-z0-9]+/).filter(Boolean);
}

function titleToken(token: string): string {
  const lower = token.toLowerCase();
  return ACRONYMS[lower] ?? lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Last-resort display name for an id that resolves to nothing we hold:
 * "claude-opus-4-6-high" -> "Claude Opus 4.6 (high)". Deliberately dumb — it
 * never invents an association with a model or benchmark we do not have.
 */
export function prettifySlug(slug: string): string {
  const tokens = tokenize(slug);
  if (tokens.length === 0) return slug;
  const last = tokens[tokens.length - 1].toLowerCase();
  const suffix =
    tokens.length > 1 && EFFORT_SUFFIXES.has(last) ? tokens.pop() : null;

  const parts: string[] = [];
  for (const token of tokens) {
    const prev = parts[parts.length - 1];
    if (/^\d+$/.test(token) && prev !== undefined) {
      // Version fragments rejoin as "4" + "6" -> "4.6", but a first number
      // after a word stays a separate word: "opus" + "4" -> "Opus 4".
      parts[parts.length - 1] = /\d$/.test(prev) ? `${prev}.${token}` : `${prev} ${token}`;
    } else {
      parts.push(titleToken(token));
    }
  }
  const base = parts.join(" ");
  return suffix ? `${base} (${suffix.toLowerCase()})` : base;
}

/** Comparable form for "does this prose already name that thing?" checks. */
function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** A successor id may point outside this dataset; say so in plain text. */
function successorName(id: string): string {
  return benchmarkById.get(id)?.name ?? prettifySlug(id);
}

export type BenchmarkStatus = "current" | "saturated" | "retired";

/** Display label per lifecycle state. The enum value itself is unchanged. */
const BENCHMARK_STATUS_LABEL: Record<BenchmarkStatus, string> = {
  current: "현역",
  saturated: "포화",
  retired: "은퇴",
};

export interface BenchmarkStatusMeta {
  status: BenchmarkStatus;
  /** Badge label; null when the benchmark is current and needs no marking. */
  label: string | null;
  tone: BadgeTone;
  /** Everything a reader needs on hover: what it measures, and its lifecycle. */
  title: string;
}

export function benchmarkStatus(b: Benchmark): BenchmarkStatusMeta {
  const status: BenchmarkStatus =
    b.status === "saturated" || b.status === "retired" ? b.status : "current";

  const sentences: string[] = [b.description];
  if (status !== "current") {
    sentences.push(
      `연속성을 위해 남겨둔 것뿐입니다 — ${BENCHMARK_STATUS_LABEL[status]} 벤치마크는 현역 벤치마크와 나란히 놓을 수 있는 비교 신호가 아닙니다.`,
    );
  }
  if (b.statusNote) sentences.push(b.statusNote);
  if (b.supersededBy) {
    const successor = successorName(b.supersededBy);
    // Skip the boilerplate when the note already names the successor itself,
    // where it is written with the successor's real punctuation.
    if (!squash(b.statusNote ?? "").includes(squash(successor))) {
      sentences.push(`후속 벤치마크는 ${successor}입니다.`);
    }
  }

  return {
    status,
    label: status === "current" ? null : BENCHMARK_STATUS_LABEL[status],
    tone: status === "retired" ? "bad" : "warn",
    title: sentences.join(" "),
  };
}

/** True when at least one column on screen is no longer a live signal. */
export function hasLifecycleFlags(list: Benchmark[]): boolean {
  return list.some((b) => benchmarkStatus(b).status !== "current");
}

/**
 * Leaderboard rows arrive as source slugs ("claude-opus-4-6-high"). Where the
 * entry resolves to a model we hold, show that model's real name and keep the
 * variant suffix, because "-high" is a genuinely different row.
 */
/**
 * A name a source already wrote for humans — it has spacing, capitalisation
 * or parenthesised qualifiers. Prettifying one of these only damages it
 * (title-casing "GLM" to "Glm", splitting "v2.5" apart), so it passes through.
 */
function looksHumanWritten(value: string): boolean {
  return /\s/.test(value) || /[A-Z]/.test(value);
}

export function leaderboardEntryLabel(
  entry: LeaderboardEntry,
  modelMap: Map<string, Model>,
): string {
  const sourceName = typeof entry.modelName === "string" ? entry.modelName : "";
  const model = entry.modelId ? modelMap.get(entry.modelId) : undefined;
  if (!model) {
    const raw = sourceName || entry.modelId || "";
    return looksHumanWritten(raw) ? raw : prettifySlug(raw);
  }

  const tokens = tokenize(sourceName);
  const candidates = [stripPrefix(tokens, model.id), stripPrefix(tokens, model.name)]
    .filter((rest): rest is string[] => rest !== null)
    .sort((a, b) => a.length - b.length);

  // No shared prefix means the source called it something we cannot line up
  // with this model's name; keep the source's own wording rather than guess.
  if (candidates.length === 0)
    return looksHumanWritten(sourceName) ? sourceName : prettifySlug(sourceName);

  const rest = candidates[0];
  return rest.length > 0 ? `${model.name} (${rest.join(" ")})` : model.name;
}

function stripPrefix(tokens: string[], prefix: string): string[] | null {
  const head = tokenize(prefix);
  if (head.length === 0 || tokens.length < head.length) return null;
  for (let i = 0; i < head.length; i++) {
    if (tokens[i].toLowerCase() !== head[i].toLowerCase()) return null;
  }
  return tokens.slice(head.length);
}
