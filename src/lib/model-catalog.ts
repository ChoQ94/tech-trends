import { unstable_cache } from "next/cache";
import { cache } from "react";

import { DATA_TTL_SECONDS } from "@/lib/cache";
import type {
  Model,
  ModelProvenance,
  ModelVariant,
  Pricing,
  Provider,
} from "@/lib/types";
import idMapRaw from "../../data/model-id-map.json";
import supplementRaw from "../../data/models-supplement.json";

/**
 * The model catalog, fetched from OpenRouter.
 *
 * This replaced a hand-typed data/models.json. That trade is worth stating
 * plainly, because every figure on /models now has a source that is not the
 * vendor:
 *
 *   - `created` is the date OpenRouter *listed* the model, not the date the
 *     vendor announced it. They differ by days.
 *   - `pricing` is what OpenRouter charges to route the model, which is not
 *     necessarily the vendor's own list price.
 *   - `openWeights` is inferred from the presence of a HuggingFace id — a
 *     reasonable signal, not a licence check.
 *   - lifecycle status is not published at all, so almost every row is
 *     `unclassified` rather than guessed.
 *
 * What we lost with the curated file: a human-assigned flagship/current/
 * preview/legacy ranking, and per-model prose notes. What we gained: 390-odd
 * models instead of 45, and figures that change when the world does.
 */

export const CATALOG_ENDPOINT = "https://openrouter.ai/api/v1/models";

/**
 * One fetch per cache window, shared by every visitor — same policy, and
 * now literally the same number, as the boards. See src/lib/cache.ts.
 */
export const CATALOG_TTL_SECONDS = DATA_TTL_SECONDS;

/**
 * OpenRouter ships `2098-12-31` on several z-ai rows to mean "no expiry".
 * Anything this far out is a sentinel, not a retirement date, and rendering
 * it as one would be inventing a fact. Ten years is well past any real
 * scheduled sunset and well short of the sentinel.
 */
const EXPIRY_HORIZON_YEARS = 10;

/* -------------------------------------------------------------------------
 * The upstream payload, typed defensively.
 * ---------------------------------------------------------------------- */

interface RawModel {
  id?: unknown;
  canonical_slug?: unknown;
  hugging_face_id?: unknown;
  name?: unknown;
  created?: unknown;
  context_length?: unknown;
  architecture?: { input_modalities?: unknown } | null;
  pricing?: { prompt?: unknown; completion?: unknown } | null;
  top_provider?: { max_completion_tokens?: unknown } | null;
  expiration_date?: unknown;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/* -------------------------------------------------------------------------
 * Identity: ids, names, providers, families.
 * ---------------------------------------------------------------------- */

/** "anthropic/claude-opus-5:batch" -> ["anthropic/claude-opus-5", "batch"] */
function splitVariant(id: string): [string, string | null] {
  const i = id.indexOf(":");
  return i < 0 ? [id, null] : [id.slice(0, i), id.slice(i + 1)];
}

/** "anthropic/claude-opus-5" -> "anthropic" */
function vendorOf(id: string): string {
  return id.replace(/^~/, "").split("/")[0] ?? id;
}

/** "anthropic/claude-opus-5" -> "claude-opus-5" */
function slugOf(id: string): string {
  const rest = id.replace(/^~/, "").split("/").slice(1).join("/");
  return rest || id;
}

/**
 * OpenRouter prefixes most display names with the vendor ("Anthropic: Claude
 * Opus 4.6") and some not at all ("Claude Opus 5"). The provider is rendered
 * in its own column, so the prefix is stripped rather than printed twice.
 */
function stripVendorPrefix(name: string): string {
  const i = name.indexOf(":");
  return i < 0 ? name : name.slice(i + 1).trim() || name;
}

const ACRONYMS: Record<string, string> = {
  ai: "AI",
  glm: "GLM",
  gpt: "GPT",
  ibm: "IBM",
  llm: "LLM",
  oss: "OSS",
};

function titleWord(word: string): string {
  const lower = word.toLowerCase();
  return ACRONYMS[lower] ?? lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Provider labels come from OpenRouter's own display names rather than a
 * table we maintain: for each vendor prefix, the label it uses most often.
 * Five vendors prefix nothing at all, and those fall back to the id.
 *
 * Deliberately not corrected. OpenRouter calls x-ai "SpaceXAI"; printing
 * "xAI" instead would be us quietly overruling the source this page says it
 * is quoting.
 */
function buildProviderLabels(raw: RawModel[]): Map<string, string> {
  const votes = new Map<string, Map<string, number>>();
  for (const m of raw) {
    const id = str(m.id);
    const name = str(m.name);
    if (!id || !name) continue;
    const i = name.indexOf(":");
    if (i < 0) continue;
    const label = name.slice(0, i).trim();
    if (!label) continue;
    const vendor = vendorOf(id);
    let bucket = votes.get(vendor);
    if (!bucket) votes.set(vendor, (bucket = new Map()));
    bucket.set(label, (bucket.get(label) ?? 0) + 1);
  }

  const labels = new Map<string, string>();
  for (const [vendor, bucket] of votes) {
    const best = [...bucket].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0];
    if (best) labels.set(vendor, best[0]);
  }
  return labels;
}

function providerFor(id: string, labels: Map<string, string>): Provider {
  const vendor = vendorOf(id);
  return (
    labels.get(vendor) ?? vendor.split(/[-_]/).map(titleWord).join(" ")
  );
}

/**
 * Family is derived mechanically from the id: the leading words of the slug
 * up to the first one carrying a digit.
 *
 *   claude-opus-5, claude-opus-5-fast, claude-opus-4.8  -> "Claude Opus"
 *   gpt-5.6-sol, gpt-5.4                                -> "GPT"
 *   qwen3.8-max                                         -> "Qwen"
 *
 * This is grouping, not judgement: it says two ids share a name stem, and
 * nothing about which of them replaced which. It is what puts `-fast` next
 * to the model it is a fast build of, instead of two unrelated rows.
 */
function familyOf(id: string, provider?: Provider): string {
  const parts = slugOf(id).split("-");
  const head: string[] = [];
  for (const part of parts) {
    if (/\d/.test(part)) break;
    head.push(part);
  }
  if (head.length === 0) {
    // "qwen3.8-max": the very first word already carries its version.
    const trimmed = parts[0]?.replace(/[\d.]+$/, "");
    if (trimmed) head.push(trimmed);
  }
  if (head.length === 0) return slugOf(id);
  const derived = head.map(titleWord).join(" ");
  // "deepseek/deepseek-v4-flash" derives "Deepseek" beside a provider column
  // reading "DeepSeek". Same word, two spellings, one row: prefer the
  // source's own casing when the stem is just the vendor's name again.
  return provider && derived.toLowerCase() === String(provider).toLowerCase()
    ? String(provider)
    : derived;
}

/* -------------------------------------------------------------------------
 * Fields.
 * ---------------------------------------------------------------------- */

/**
 * OpenRouter quotes price as a decimal string in USD per single token
 * ("0.000005"); our schema is USD per 1M. A model with no price at all
 * (both sides absent) gets null rather than a fabricated zero — but a real
 * zero, which the `:free` tier genuinely is, is kept as zero.
 */
function pricingOf(raw: RawModel["pricing"]): Pricing | null {
  const input = num(raw?.prompt);
  const output = num(raw?.completion);
  if (input === null && output === null) return null;
  return {
    input: input === null ? null : input * 1_000_000,
    output: output === null ? null : output * 1_000_000,
    unit: "USD per 1M tokens",
  };
}

/** Unix seconds -> "2026-07-24". OpenRouter's listing date, not the vendor's. */
function listedOn(created: unknown): string | null {
  const seconds = num(created);
  if (seconds === null || seconds <= 0) return null;
  const d = new Date(seconds * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** A retirement date, or null when the value is a sentinel we must not show. */
function retirementOf(value: unknown, now: Date): string | null {
  const raw = str(value);
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCFullYear() > now.getUTCFullYear() + EXPIRY_HORIZON_YEARS) {
    return null;
  }
  return raw.slice(0, 10);
}

/* -------------------------------------------------------------------------
 * The committed id map — what keeps every existing join alive.
 * ---------------------------------------------------------------------- */

interface IdMapEntry {
  oldId: string;
  oldName: string;
  openRouterId: string;
}

interface IdMapFile {
  generatedAt?: string;
  entries?: IdMapEntry[];
}

const idMap = idMapRaw as unknown as IdMapFile;

const ID_MAP_ENTRIES: IdMapEntry[] = (idMap.entries ?? []).filter(
  (e): e is IdMapEntry =>
    !!e && typeof e.oldId === "string" && typeof e.openRouterId === "string",
);

/** OpenRouter id -> the ids and names this model used to answer to. */
const ALIASES_BY_OR_ID = new Map<string, string[]>();
for (const entry of ID_MAP_ENTRIES) {
  const bucket = ALIASES_BY_OR_ID.get(entry.openRouterId) ?? [];
  bucket.push(entry.oldId);
  if (entry.oldName) bucket.push(entry.oldName);
  ALIASES_BY_OR_ID.set(entry.openRouterId, bucket);
}

export function getIdMapGeneratedAt(): string | null {
  return typeof idMap.generatedAt === "string" ? idMap.generatedAt : null;
}

export function getIdMapSize(): number {
  return ID_MAP_ENTRIES.length;
}

/* -------------------------------------------------------------------------
 * The five OpenRouter does not carry.
 * ---------------------------------------------------------------------- */

/**
 * Models OpenRouter has no listing for — restricted-access or retired — kept
 * so that dropping the curated file does not silently delete them. Marked
 * `manual` everywhere they surface, because nothing refreshes them.
 *
 * This is a file in this repository, so it is merged in `withSupplement`,
 * past the cache boundary. Editing it must take effect on the next build;
 * see the note on `LiveCatalogData` for what happens when it does not.
 */
export const SUPPLEMENT_MODELS: Model[] = (
  Array.isArray(supplementRaw) ? (supplementRaw as unknown as Model[]) : []
)
  .filter((m): m is Model => !!m && typeof m.id === "string")
  .map((m) => ({ ...m, provenance: "manual" as ModelProvenance }));

/* -------------------------------------------------------------------------
 * Normalisation.
 * ---------------------------------------------------------------------- */

export interface CatalogCounts {
  /** Rows OpenRouter returned, before anything was folded or set aside. */
  listed: number;
  /** `…:free` / `…:batch` rows folded into the model they price. */
  variantsFolded: number;
  /** `~vendor/*-latest` moving pointers set aside; see below. */
  aliasPointers: number;
  /** Rows in the final catalog sourced from OpenRouter. */
  live: number;
  /** Rows added from data/models-supplement.json. */
  supplement: number;
  /** Live rows we could attach a former catalog id to. */
  aliased: number;
}

/**
 * What actually goes through the cache: OpenRouter's answer, normalised, and
 * nothing else.
 *
 * Two rules govern this shape, and both are scars.
 *
 * It has to be plain JSON, because whatever `unstable_cache` holds is
 * serialised — a `Map` handed to it comes back a bare object with no
 * `.has()`, which is exactly how this first broke.
 *
 * It also has to be *remote*. `unstable_cache` keys on the function identity
 * and the key array, never on the bytes of a file, and Next persists the
 * entry across requests, builds and deployments alike — Vercel restores
 * `.next/cache` between deploys. So a file committed to this repository that
 * is folded in on the far side of this boundary is frozen for a whole TTL
 * window: editing data/models-supplement.json changed nothing for six hours,
 * a rebuild and a deploy included, and the only cure was deleting
 * `.next/cache/fetch-cache` by hand. A data-only commit could ship green and
 * still serve the old strings. That merge now happens in `withSupplement`,
 * on this side of the cache, so an edit lands on the next build.
 *
 * The OpenRouter fetch stays cached, because that is the part the cache is
 * for: one request per window for every visitor, rather than one per view.
 */
interface LiveCatalogData {
  models: Model[];
  live: boolean;
  /** When the data being shown was actually fetched. */
  retrievedAt: string;
  error: string | null;
  /** `supplement` is counted past the cache boundary; see `withSupplement`. */
  counts: Omit<CatalogCounts, "supplement">;
}

/** The catalog the app sees: the cached live rows plus the committed five. */
export interface CatalogData {
  models: Model[];
  live: boolean;
  /** When the data being shown was actually fetched. */
  retrievedAt: string;
  error: string | null;
  counts: CatalogCounts;
}

export interface Catalog extends CatalogData {
  /**
   * Every id the catalog answers to — OpenRouter slugs, the former curated
   * ids, and the names those carried — mapped to the model. Committed
   * benchmark scores are keyed by the old ids, so both must resolve.
   *
   * Rebuilt from `models` on this side of the cache, never stored in it.
   */
  map: Map<string, Model>;
}

export function normalizeCatalog(payload: unknown, now = new Date()): {
  models: Model[];
  counts: Omit<CatalogCounts, "supplement">;
} {
  const raw: RawModel[] = Array.isArray((payload as { data?: unknown })?.data)
    ? ((payload as { data: RawModel[] }).data ?? [])
    : [];

  const labels = buildProviderLabels(raw);

  const rows = raw.filter((m) => str(m.id));

  /**
   * `~vendor/*-latest` are moving pointers ("Claude Opus Latest"), not
   * models: each resolves to whichever model the vendor currently points it
   * at, so listing them would double-count a model already in the table
   * under a name that will mean something different next month.
   */
  const pointers = rows.filter((m) => str(m.id)!.startsWith("~"));
  const listed = rows.filter((m) => !str(m.id)!.startsWith("~"));

  const byId = new Map(listed.map((m) => [str(m.id)!, m]));

  /**
   * `:free` and `:batch` are the same model at a different price. They are
   * folded into the row they belong to — unless the base is not listed at
   * all, in which case the variant is the only listing there is and stands
   * on its own rather than being dropped.
   */
  const variantsByBase = new Map<string, ModelVariant[]>();
  const promoted: RawModel[] = [];
  let variantsFolded = 0;

  for (const m of listed) {
    const id = str(m.id)!;
    const [base, suffix] = splitVariant(id);
    if (!suffix) continue;
    if (!byId.has(base)) {
      promoted.push(m);
      continue;
    }
    const bucket = variantsByBase.get(base) ?? [];
    bucket.push({ id, suffix, pricing: pricingOf(m.pricing) });
    variantsByBase.set(base, bucket);
    variantsFolded++;
  }

  const bases = listed.filter((m) => !splitVariant(str(m.id)!)[1]);

  const models: Model[] = [...bases, ...promoted].map((m) => {
    const id = str(m.id)!;
    const provider = providerFor(id, labels);
    const retiresOn = retirementOf(m.expiration_date, now);
    const aliases = ALIASES_BY_OR_ID.get(id);
    const modalities = Array.isArray(m.architecture?.input_modalities)
      ? m.architecture.input_modalities.filter(
          (x): x is string => typeof x === "string",
        )
      : [];

    return {
      id,
      name: stripVendorPrefix(str(m.name) ?? id),
      provider,
      family: familyOf(id, provider),
      releaseDate: listedOn(m.created),
      // The only lifecycle fact OpenRouter publishes. Everything else stays
      // unclassified rather than being guessed at.
      status: retiresOn ? "deprecated" : "unclassified",
      contextWindow: num(m.context_length),
      maxOutput: num(m.top_provider?.max_completion_tokens),
      modality: modalities,
      pricing: pricingOf(m.pricing),
      openWeights: !!str(m.hugging_face_id),
      url: `https://openrouter.ai/${splitVariant(id)[0]}`,
      notes: null,
      provenance: "openrouter" as ModelProvenance,
      ...(aliases ? { aliases } : {}),
      ...(variantsByBase.has(id)
        ? {
            variants: variantsByBase
              .get(id)!
              .sort((a, b) => a.suffix.localeCompare(b.suffix)),
          }
        : {}),
      retiresOn,
    };
  });

  return {
    models,
    counts: {
      listed: rows.length,
      variantsFolded,
      aliasPointers: pointers.length,
      live: models.length,
      aliased: models.filter((m) => m.aliases?.length).length,
    },
  };
}

/* -------------------------------------------------------------------------
 * Fetching.
 * ---------------------------------------------------------------------- */

function indexById(models: Model[]): Map<string, Model> {
  const map = new Map<string, Model>();
  for (const model of models) {
    for (const key of [model.id, ...(model.aliases ?? [])]) {
      if (key && !map.has(key)) map.set(key, model);
    }
  }
  return map;
}

/**
 * What is shown when OpenRouter cannot be reached.
 *
 * Not an empty catalog: data/benchmarks.json holds 79 scores and two
 * leaderboards keyed by the former catalog ids, and eight live fetchers
 * resolve board names against this map. An empty catalog would render
 * /benchmarks as a blank grid and silently unmap every board row. So the id
 * map is used as an identity table — real ids, real names, and every spec
 * field null, marked `id-map` so nothing here can be mistaken for a fetched
 * figure.
 */
function degraded(error: string): LiveCatalogData {
  const stubs: Model[] = ID_MAP_ENTRIES.map((e) => ({
    id: e.openRouterId,
    name: e.oldName || e.openRouterId,
    provider: providerFor(e.openRouterId, new Map()),
    family: familyOf(e.openRouterId, providerFor(e.openRouterId, new Map())),
    releaseDate: null,
    status: "unclassified" as const,
    contextWindow: null,
    maxOutput: null,
    modality: [],
    pricing: null,
    openWeights: false,
    url: `https://openrouter.ai/${e.openRouterId}`,
    notes: null,
    provenance: "id-map" as ModelProvenance,
    aliases: [e.oldId, e.oldName].filter(Boolean),
    retiresOn: null,
  }));

  return {
    models: stubs,
    live: false,
    retrievedAt: new Date().toISOString(),
    error,
    counts: {
      listed: 0,
      variantsFolded: 0,
      aliasPointers: 0,
      live: 0,
      aliased: stubs.length,
    },
  };
}

async function fetchCatalogUncached(): Promise<LiveCatalogData> {
  try {
    const res = await fetch(CATALOG_ENDPOINT, {
      headers: { accept: "application/json" },
      // The aggregate is what unstable_cache holds; asking the data cache to
      // hold it too would only pin a second copy on a different clock.
      cache: "no-store",
    });
    if (!res.ok) {
      return degraded(`OpenRouter가 HTTP ${res.status}을(를) 반환했습니다.`);
    }
    const { models, counts } = normalizeCatalog(await res.json());
    if (models.length === 0) {
      return degraded("OpenRouter가 쓸 수 있는 모델을 반환하지 않았습니다.");
    }
    return {
      models,
      live: true,
      retrievedAt: new Date().toISOString(),
      error: null,
      counts,
    };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return degraded(`OpenRouter에 연결하지 못했습니다: ${reason}`);
  }
}

/**
 * One fetch per cache window, shared by every visitor.
 *
 * This is a public deployment: without a cache in front of it, every page
 * view on every route that touches the catalog would be a request to
 * someone else's API. `retrievedAt` is the moment of the real fetch, not of
 * the cache read, so the page reports when the numbers were obtained rather
 * than implying they are seconds old — the same rule the boards follow in
 * src/lib/leaderboards.ts.
 *
 * The key says `-live` because that is now all this holds: the rows
 * OpenRouter served. The committed supplement is merged past it.
 */
const cachedFetchCatalog = unstable_cache(
  fetchCatalogUncached,
  ["openrouter-model-catalog-live"],
  { revalidate: CATALOG_TTL_SECONDS, tags: ["model-catalog"] },
);

/**
 * The five committed models, folded in on this side of the cache.
 *
 * Read at module scope from data/models-supplement.json, which means the
 * value the bundle carries is whatever the file said at build time — and
 * because nothing here is memoised by `unstable_cache`, that is what every
 * build serves. Live rows come first so that an id present in both resolves
 * to the fetched row, which is the order the merge has always had.
 */
function withSupplement(data: LiveCatalogData): CatalogData {
  return {
    ...data,
    models: [...data.models, ...SUPPLEMENT_MODELS],
    counts: { ...data.counts, supplement: SUPPLEMENT_MODELS.length },
  };
}

/**
 * The catalog, with the supplement merged and its lookup map rebuilt on this
 * side of the cache.
 *
 * `cache` is React's per-request memo, so the several callers a single page
 * has — the table, the matrix, each leaderboard card — share one map rather
 * than rebuilding it apiece. The merge rides along inside it, so the five
 * rows are appended once per request, not once per caller.
 */
export const fetchCatalog = cache(async (): Promise<Catalog> => {
  const data = withSupplement(await cachedFetchCatalog());
  return { ...data, map: indexById(data.models) };
});
