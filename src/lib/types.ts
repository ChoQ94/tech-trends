/**
 * Shared data contract for the whole dashboard.
 *
 * data/benchmarks.json, data/models-supplement.json and the normalised
 * OpenRouter catalog in src/lib/model-catalog.ts must all conform to these
 * types. The model catalog used to be a committed data/models.json; it is now
 * fetched, which is why several fields below carry a note about who is
 * actually asserting them.
 */

export type Provider =
  | "Anthropic"
  | "OpenAI"
  | "Google"
  | "Meta"
  | "xAI"
  | "DeepSeek"
  | "Alibaba"
  | "Mistral"
  | (string & {});

/**
 * The catalog is fetched from OpenRouter, which publishes no lifecycle field.
 * Only one status is derivable from what it does publish — a real future
 * `expiration_date` means the model is scheduled to stop being served — so
 * that is the only one we ever set. Everything else is `unclassified`, which
 * is a statement about our knowledge, not about the model: we do not know
 * whether it is a flagship, and guessing would be inventing an editorial
 * judgement no source made.
 *
 * The four editorial values survive only on models in
 * data/models-supplement.json, and even there only `deprecated` is used, for
 * models with a recorded retirement date.
 */
export type ModelStatus =
  | "flagship"
  | "current"
  | "preview"
  | "legacy"
  | "deprecated"
  | "unclassified";

/** Where a catalog row came from, which decides how far it can be trusted. */
export type ModelProvenance =
  /** Fetched live from the OpenRouter models API. */
  | "openrouter"
  /** Typed by a person because OpenRouter does not list the model. */
  | "manual"
  /**
   * Identity only, reconstructed from data/model-id-map.json because the live
   * fetch failed. Name and id are real; every spec field is null.
   */
  | "id-map";

/**
 * A billing variant of a model: same weights and same context, different
 * price. OpenRouter lists these as separate ids (`…:free`, `…:batch`); we
 * fold them into the model they belong to rather than showing one model three
 * times, and keep them here so the price difference stays visible.
 */
export interface ModelVariant {
  /** The full OpenRouter id, e.g. "anthropic/claude-opus-5:batch". */
  id: string;
  /** The suffix after the colon: "free", "batch". */
  suffix: string;
  pricing: Pricing | null;
}

export interface Pricing {
  input: number | null;
  output: number | null;
  unit: string;
}

export interface Model {
  id: string;
  name: string;
  provider: Provider;
  family: string;
  /**
   * For an OpenRouter-sourced row this is the date OpenRouter *listed* the
   * model, not the date the vendor announced it. The two differ by days.
   * Anywhere this is rendered, it has to be labelled as a listing date.
   */
  releaseDate: string | null;
  status: ModelStatus;
  contextWindow: number | null;
  maxOutput: number | null;
  modality: string[];
  /**
   * OpenRouter's price, converted from USD-per-token to USD per 1M. It is
   * what OpenRouter charges to route the model, which is not necessarily the
   * vendor's own list price.
   */
  pricing: Pricing | null;
  /**
   * Inferred, for an OpenRouter row, from the presence of a `hugging_face_id`
   * — a reasonable signal, not a licence check. `provenance` says whether to
   * read it as inferred or as recorded.
   */
  openWeights: boolean;
  url: string | null;
  notes: string | null;
  /** Defaults to "openrouter" when absent. */
  provenance?: ModelProvenance;
  /**
   * Ids and names this model used to be known by, from
   * data/model-id-map.json. Committed benchmark scores and every leaderboard
   * fetcher still resolve through these, so dropping one silently empties
   * part of /benchmarks.
   */
  aliases?: string[];
  /** Billing variants folded into this row; see ModelVariant. */
  variants?: ModelVariant[];
  /**
   * A real, future `expiration_date` from OpenRouter — the model is scheduled
   * to stop being served. Sentinel dates far in the future (z-ai ships
   * 2098-12-31 to mean "no expiry") are discarded, not rendered.
   */
  retiresOn?: string | null;
}

export interface Benchmark {
  id: string;
  name: string;
  description: string;
  unit: string;
  higherIsBetter: boolean;
  /**
   * Benchmarks have a lifecycle: they get saturated and they get retired.
   * A score on a non-current benchmark is kept for continuity but is not a
   * live signal, and must never be compared against a current one.
   */
  status?: "current" | "saturated" | "retired";
  /** Another benchmark id, when a successor exists in this dataset. */
  supersededBy?: string | null;
  /** One short sentence saying WHY the status is what it is. */
  statusNote?: string | null;
}

export interface Score {
  modelId: string;
  benchmarkId: string;
  score: number;
  source: "vendor" | "independent";
  sourceUrl: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  modelId: string | null;
  modelName: string;
  score: number;
  /**
   * USD per task, where the board reports it. ARC Prize treats cost as a
   * first-class axis — a top ARC-AGI-3 entry costs five figures per task —
   * so a score without it is only half the result.
   */
  costPerTask?: number | null;
  /**
   * 95% confidence interval on `score`, where the board publishes one. The
   * top of Epoch's ECI is a set of fully overlapping intervals; without this
   * the UI would render a statistical tie as a strict ordering.
   */
  ci?: { low: number; high: number } | null;
}

export interface Leaderboard {
  id: string;
  name: string;
  url: string;
  updatedAt: string;
  entries: LeaderboardEntry[];
}

export interface BenchmarkData {
  updatedAt: string;
  sources: { name: string; url: string }[];
  benchmarks: Benchmark[];
  scores: Score[];
  leaderboards: Leaderboard[];
}

/** A repository row on the GitHub trending view. */
export interface TrendingRepo {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  description: string | null;
  url: string;
  homepage: string | null;
  language: string | null;
  stars: number;
  /** Stars gained inside the selected window, when derivable; else null. */
  starsGained: number | null;
  forks: number;
  openIssues: number;
  topics: string[];
  createdAt: string;
  pushedAt: string;
  ownerAvatar: string | null;
  license: string | null;
}

export type TrendingWindow = "daily" | "weekly" | "monthly";

export interface TrendingResult {
  repos: TrendingRepo[];
  window: TrendingWindow;
  language: string | null;
  fetchedAt: string;
  /** Set when the live fetch failed and stale/empty data is being shown. */
  error: string | null;
}

/* ==========================================================================
 * Leaderboards
 *
 * Boards differ in how reachable they are. Some publish a real endpoint we
 * may call; others only render numbers into a page we have to pick apart.
 * The second kind breaks silently when the site is redesigned, so every
 * source carries its own fetch kind, and every fetch can fall back to a
 * committed snapshot rather than showing nothing — or worse, showing stale
 * numbers as if they were live.
 * ======================================================================= */

export type FetchKind =
  /** Documented JSON endpoint intended for callers. */
  | "json-api"
  /** Static JSON asset the site publishes alongside the page. */
  | "static-json"
  /** Downloadable CSV. */
  | "csv"
  /** JSON embedded in the HTML (script tag, RSC payload). Fragile. */
  | "scrape-embedded-json"
  /** Parsed out of rendered markup. Most fragile. */
  | "scrape-html";

/** How much weight a board's ranking deserves. */
export type Credibility = "high" | "medium" | "caveated";

export interface LeaderboardSource {
  id: string;
  name: string;
  /** Human-facing page. */
  url: string;
  /** What we actually call. */
  endpoint: string;
  method: "GET" | "POST";
  fetchKind: FetchKind;
  /** True when the endpoint needs a key we do not ship. */
  requiresAuth: boolean;
  /** e.g. "CC BY 4.0", or null when unstated. */
  license: string | null;
  /** What the board measures, in one sentence. */
  measures: string;
  /** The unit of the score column. */
  unit: string;
  credibility: Credibility;
  /** Why it deserves that credibility, and what to distrust. */
  credibilityNote: string;
  /**
   * A stake the operator has in the results — e.g. the board's owner also
   * ships a ranked model. Null when there is none we know of.
   */
  conflictOfInterest: string | null;
  /** How often the upstream board itself changes. */
  cadence: string;
}

export type SourceHealth =
  /** Fetched successfully this request (or from a fresh cache). */
  | "live"
  /** Fetch failed; showing the committed snapshot instead. */
  | "stale"
  /** Never fetched successfully and no snapshot exists. */
  | "unavailable";

export interface LeaderboardResult {
  sourceId: string;
  /** The boards this source yielded; one source may publish several. */
  boards: Leaderboard[];
  health: SourceHealth;
  /** When the data we are showing was actually retrieved. */
  retrievedAt: string;
  /** Upstream's own "last updated", when it publishes one. */
  upstreamUpdatedAt: string | null;
  /** Present when health is not "live" — why the live path failed. */
  error: string | null;
}
