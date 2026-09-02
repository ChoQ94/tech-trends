import type { BadgeTone } from "@/components/ui";
import type { Model, ModelStatus, Provider } from "@/lib/types";

/**
 * Everything about the catalog that is a pure function of a list of models:
 * ordering, filtering, grouping, and the provider/status presentation tables.
 *
 * Split out of src/lib/models.ts so it can be imported from a Client
 * Component without dragging the catalog *fetch* along with it. That module
 * imports `unstable_cache`, data/model-id-map.json and
 * data/models-supplement.json; before the split, /models and /leaderboards
 * each shipped a 30-40KB chunk of exactly that to the browser, to use a
 * colour lookup and an array filter. Nothing in this file reads a file, hits
 * the network, or touches a cache.
 */

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
export function byReleaseDesc(a: Model, b: Model): number {
  const at = a.releaseDate ? Date.parse(a.releaseDate) : NaN;
  const bt = b.releaseDate ? Date.parse(b.releaseDate) : NaN;
  const aOk = Number.isFinite(at);
  const bOk = Number.isFinite(bt);
  if (aOk && bOk) return bt - at || a.name.localeCompare(b.name);
  if (aOk) return -1;
  if (bOk) return 1;
  return a.name.localeCompare(b.name);
}

export function byStatusThenRelease(a: Model, b: Model): number {
  const s = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
  return s !== 0 ? s : byReleaseDesc(a, b);
}

/**
 * Providers ordered by how many models they have, then alphabetically.
 *
 * Pure and synchronous, over a list the caller already holds. /models runs
 * this in the browser against the prerendered catalog, so it must not reach
 * for the fetch — and because the ordering depends only on the counts, it
 * returns the same list whatever order the input arrives in.
 */
export function listProviders(list: Model[]): Provider[] {
  const counts = new Map<Provider, number>();
  for (const m of list) {
    counts.set(m.provider, (counts.get(m.provider) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .map(([p]) => p);
}

/** The statuses actually present, in lifecycle order. Pure; see listProviders. */
export function listStatuses(list: Model[]): ModelStatus[] {
  const present = new Set(list.map((m) => m.status));
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

/**
 * Filters are user-supplied query params; unknown values are ignored, which
 * is what makes `?provider=Bogus` fall through to the unfiltered catalog
 * rather than to an empty table.
 *
 * Pure and synchronous, preserving the order of the list handed in — so a
 * caller that passes `getAllModels()` gets the catalog sort back. /models
 * calls this in the browser on every filter change.
 */
export function selectModels(list: Model[], filter: ModelFilter): Model[] {
  const provider =
    filter.provider && list.some((m) => m.provider === filter.provider)
      ? filter.provider
      : null;
  const status =
    filter.status && isKnownStatus(filter.status) ? filter.status : null;

  return list.filter(
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
