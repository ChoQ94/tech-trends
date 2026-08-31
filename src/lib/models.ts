import type { BadgeTone } from "@/components/ui";
import { fetchCatalog } from "@/lib/model-catalog";
import type { Catalog } from "@/lib/model-catalog";
import type { Model, ModelStatus, Provider } from "@/lib/types";

/**
 * Queries over the model catalog.
 *
 * Everything here is async because the catalog is now a live fetch of
 * OpenRouter's models API rather than a JSON file imported at build time.
 * The fetch itself is cached for an hour in src/lib/model-catalog.ts, so
 * calling several of these on one page costs one request, not several.
 */

export type { Catalog } from "@/lib/model-catalog";

export async function getCatalog(): Promise<Catalog> {
  return fetchCatalog();
}

/**
 * Ordering. With OpenRouter as the source almost every row is
 * `unclassified`, so in practice this is a date sort — but `deprecated`,
 * the one status we can derive, still sinks to the bottom where it belongs.
 */
const STATUS_ORDER: Record<ModelStatus, number> = {
  flagship: 0,
  current: 1,
  preview: 2,
  unclassified: 3,
  legacy: 4,
  deprecated: 5,
};

/** Newest first; models with no listing date sort last. */
function byReleaseDesc(a: Model, b: Model): number {
  const at = a.releaseDate ? Date.parse(a.releaseDate) : NaN;
  const bt = b.releaseDate ? Date.parse(b.releaseDate) : NaN;
  const aOk = Number.isFinite(at);
  const bOk = Number.isFinite(bt);
  if (aOk && bOk) return bt - at || a.name.localeCompare(b.name);
  if (aOk) return -1;
  if (bOk) return 1;
  return a.name.localeCompare(b.name);
}

function byStatusThenRelease(a: Model, b: Model): number {
  const s = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
  return s !== 0 ? s : byReleaseDesc(a, b);
}

export async function getAllModels(): Promise<Model[]> {
  return [...(await fetchCatalog()).models].sort(byStatusThenRelease);
}

export async function getModelById(id: string): Promise<Model | undefined> {
  return (await fetchCatalog()).map.get(id);
}

/**
 * Every id the catalog answers to -> the model.
 *
 * Keyed by the OpenRouter slug *and* by the ids and names the model carried
 * in the old hand-curated catalog, from data/model-id-map.json. That is what
 * lets data/benchmarks.json — 79 scores and two leaderboards keyed by the old
 * ids — and all eight leaderboard fetchers keep resolving untouched.
 */
export async function getModelMap(): Promise<Map<string, Model>> {
  return (await fetchCatalog()).map;
}

/** Providers ordered by how many models they have, then alphabetically. */
export async function getProviders(): Promise<Provider[]> {
  const counts = new Map<Provider, number>();
  for (const m of (await fetchCatalog()).models) {
    counts.set(m.provider, (counts.get(m.provider) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .map(([p]) => p);
}

export async function getStatuses(): Promise<ModelStatus[]> {
  const present = new Set((await fetchCatalog()).models.map((m) => m.status));
  return (Object.keys(STATUS_ORDER) as ModelStatus[]).filter((s) =>
    present.has(s),
  );
}

export interface ModelFilter {
  provider?: string | null;
  status?: string | null;
  /** Restrict to models whose weights we believe are downloadable. */
  openWeights?: boolean;
}

function isKnownStatus(value: string): value is ModelStatus {
  return value in STATUS_ORDER;
}

/** Filters are user-supplied query params; unknown values are ignored. */
export async function filterModels(filter: ModelFilter): Promise<Model[]> {
  const all = await getAllModels();
  const provider =
    filter.provider && all.some((m) => m.provider === filter.provider)
      ? filter.provider
      : null;
  const status =
    filter.status && isKnownStatus(filter.status) ? filter.status : null;

  return all.filter(
    (m) =>
      (!provider || m.provider === provider) &&
      (!status || m.status === status) &&
      (!filter.openWeights || m.openWeights),
  );
}

export interface ProviderGroup {
  provider: Provider;
  models: Model[];
}

export function groupByProvider(list: Model[]): ProviderGroup[] {
  const groups = new Map<Provider, Model[]>();
  for (const m of list) {
    const bucket = groups.get(m.provider);
    if (bucket) bucket.push(m);
    else groups.set(m.provider, [m]);
  }
  return [...groups.entries()]
    .map(([provider, ms]) => ({
      provider,
      models: [...ms].sort(byStatusThenRelease),
    }))
    .sort(
      (a, b) =>
        b.models.length - a.models.length ||
        String(a.provider).localeCompare(String(b.provider)),
    );
}

export interface FamilyGroup {
  family: string;
  provider: Provider;
  /** Newest listing first. */
  models: Model[];
  /** Rows in this family that carry at least one billing variant. */
  variantCount: number;
}

/**
 * Models bucketed by the family stem derived from their id, newest listing
 * first.
 *
 * This replaced a lineage view that grouped a family around its flagship and
 * its retired members. Neither of those facts survives the move to
 * OpenRouter, which publishes no lifecycle at all — so this makes no claim
 * about succession. What it does do is stop `claude-opus-5`,
 * `claude-opus-5-fast` and `claude-opus-4.8` reading as three unrelated
 * models, which is the part that was actually load-bearing.
 */
export function getFamilies(list: Model[]): FamilyGroup[] {
  const groups = new Map<string, Model[]>();
  for (const m of list) {
    const key = `${m.provider}::${m.family || m.name}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(m);
    else groups.set(key, [m]);
  }
  return [...groups.values()]
    .map((ms) => {
      const sorted = [...ms].sort(byReleaseDesc);
      return {
        family: sorted[0].family || sorted[0].name,
        provider: sorted[0].provider,
        models: sorted,
        variantCount: sorted.filter((m) => m.variants?.length).length,
      };
    })
    .sort(
      (a, b) =>
        b.models.length - a.models.length ||
        byReleaseDesc(a.models[0], b.models[0]),
    );
}

export async function getLatestReleases(limit = 6): Promise<Model[]> {
  return (await getAllModels())
    .filter((m) => !!m.releaseDate && m.provenance === "openrouter")
    .sort(byReleaseDesc)
    .slice(0, limit);
}

/**
 * Models with a real scheduled retirement date — the one lifecycle fact the
 * source publishes. Sentinel far-future dates are already discarded upstream
 * in src/lib/model-catalog.ts, so anything here is a date somebody meant.
 */
export async function getRetiring(): Promise<Model[]> {
  return (await getAllModels())
    .filter((m) => !!m.retiresOn)
    .sort((a, b) => String(a.retiresOn).localeCompare(String(b.retiresOn)));
}

/** The most recent listing date in the catalog, as an ISO string. */
export async function getNewestListing(): Promise<string | null> {
  const dated = (await fetchCatalog()).models
    .map((m) => m.releaseDate)
    .filter((d): d is string => !!d && Number.isFinite(Date.parse(d)))
    .sort();
  return dated.length ? dated[dated.length - 1] : null;
}

/**
 * Tailwind cannot see dynamically built class names, so provider hues are
 * mapped to literal utilities here.
 *
 * The keys are the labels OpenRouter itself prints — "Mistral", "Qwen",
 * "SpaceXAI" — because that is what `provider` now holds. Keying this on a
 * name the source does not use silently drops the hue, which is how
 * "Mistral AI" was already once caught out here.
 */
const PROVIDER_CLASS: Record<string, { text: string; dot: string }> = {
  Anthropic: { text: "text-p-anthropic", dot: "bg-p-anthropic" },
  OpenAI: { text: "text-p-openai", dot: "bg-p-openai" },
  Google: { text: "text-p-google", dot: "bg-p-google" },
  Meta: { text: "text-p-meta", dot: "bg-p-meta" },
  SpaceXAI: { text: "text-p-xai", dot: "bg-p-xai" },
  DeepSeek: { text: "text-p-deepseek", dot: "bg-p-deepseek" },
  Qwen: { text: "text-p-alibaba", dot: "bg-p-alibaba" },
  Mistral: { text: "text-p-mistral", dot: "bg-p-mistral" },
};

/**
 * Providers outside the named list get a stable hue from a small pool, so two
 * unlisted vendors are not rendered in the same color. Three slots, and the
 * order matters: it is the modulus of the hash below, so shortening the pool
 * changes which vendor gets which hue. Dropping p-other when its old violet
 * collided with the lilac accent put both Z.ai and Moonshot AI on olive; it
 * was repointed to a green instead. See globals.css.
 */
const PROVIDER_FALLBACKS = [
  { text: "text-p-other", dot: "bg-p-other" },
  { text: "text-p-other-2", dot: "bg-p-other-2" },
  { text: "text-p-other-3", dot: "bg-p-other-3" },
] as const;

export function providerClasses(provider: Provider): {
  text: string;
  dot: string;
} {
  const key = String(provider);
  const named = PROVIDER_CLASS[key];
  if (named) return named;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return PROVIDER_FALLBACKS[hash % PROVIDER_FALLBACKS.length];
}

export const STATUS_TONE: Record<ModelStatus, BadgeTone> = {
  flagship: "accent",
  current: "good",
  // `preview` was `purple` (265°), which the lilac accent moved to within
  // 7° of; cyan is 90° clear of it. See TONES in components/ui.
  preview: "cyan",
  // Not a judgement about the model — a statement that the source publishes
  // no lifecycle for it. Deliberately the quietest tone on the page.
  unclassified: "neutral",
  legacy: "neutral",
  deprecated: "bad",
};

export function statusTone(status: ModelStatus): BadgeTone {
  return STATUS_TONE[status] ?? "neutral";
}

/** One sentence per status, for the badge's title and the filter legend. */
export const STATUS_MEANING: Record<ModelStatus, string> = {
  flagship: "Recorded by hand as the provider's most capable model.",
  current: "Recorded by hand as generally available.",
  preview: "Recorded by hand as preview or limited release.",
  unclassified:
    "OpenRouter publishes no lifecycle field, so nothing is claimed about this model's standing. It is not a statement that the model is old, or new, or second-rate.",
  legacy: "Recorded by hand as superseded.",
  deprecated:
    "OpenRouter publishes a retirement date for this model, or one was recorded by hand.",
};
