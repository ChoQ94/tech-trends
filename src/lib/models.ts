import { fetchCatalog } from "@/lib/model-catalog";
import type { Catalog } from "@/lib/model-catalog";
import {
  byReleaseDesc,
  byStatusThenRelease,
  listProviders,
  listStatuses,
  selectModels,
  type ModelFilter,
} from "@/lib/model-query";
import type { Model, ModelStatus, Provider } from "@/lib/types";

/**
 * Queries over the model catalog.
 *
 * Everything here is async because the catalog is a live fetch of
 * OpenRouter's models API rather than a JSON file imported at build time.
 * The fetch itself is cached in src/lib/model-catalog.ts, so calling several
 * of these on one page costs one request, not several.
 *
 * The query logic itself — ordering, filtering, grouping, the provider and
 * status presentation tables — lives in src/lib/model-query.ts, which is pure
 * and safe to import from the browser. This module is the half that is not:
 * it reaches through to the fetch, and importing it from a Client Component
 * drags `unstable_cache` and two committed JSON files into the bundle. That
 * is the whole reason for the split. Everything pure is re-exported below, so
 * server callers can keep importing from one place.
 */

export type { Catalog } from "@/lib/model-catalog";
export * from "@/lib/model-query";

export async function getCatalog(): Promise<Catalog> {
  return fetchCatalog();
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

export async function getProviders(): Promise<Provider[]> {
  return listProviders((await fetchCatalog()).models);
}

export async function getStatuses(): Promise<ModelStatus[]> {
  return listStatuses((await fetchCatalog()).models);
}

export async function filterModels(filter: ModelFilter): Promise<Model[]> {
  return selectModels(await getAllModels(), filter);
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
