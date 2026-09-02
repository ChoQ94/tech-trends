import Link from "next/link";
import { Empty, SectionHeader } from "@/components/ui";
import { Families } from "@/components/models/Families";
import { FilterBar, buildModelsHref } from "@/components/models/FilterBar";
import { ModelTable } from "@/components/models/ModelTable";
import {
  getFamilies,
  listProviders,
  listStatuses,
  selectModels,
} from "@/lib/model-query";
import type { Model, ModelStatus } from "@/lib/types";

/**
 * Everything on /models below the header: the filter chips, the count, the
 * table and the families grid.
 *
 * This is rendered twice from two different places, and that is the point.
 * The page renders it on the server with no filter applied, as the Suspense
 * fallback, so the prerendered HTML is the whole catalog rather than a
 * skeleton; ModelsBrowser renders it again in the browser with whatever the
 * query string asks for. Both go through the same function, so "what the
 * server prerenders" and "what the client shows" cannot drift apart.
 *
 * It takes only the model list. Provider order, status order and every count
 * beside a chip are derived here rather than passed in, because deriving them
 * twice is free and shipping them twice is not.
 */
export function ModelsSection({
  models,
  activeProvider,
  activeStatus,
  activeOpenWeights,
}: {
  /** The full, unfiltered catalog in its canonical sort order. */
  models: Model[];
  /** Already resolved against the catalog; see resolveModelFilters. */
  activeProvider: string | null;
  activeStatus: ModelStatus | null;
  activeOpenWeights: boolean;
}) {
  const providers = listProviders(models);
  const statuses = listStatuses(models);

  const rows = selectModels(models, {
    provider: activeProvider,
    status: activeStatus,
    openWeights: activeOpenWeights,
  });

  const providerCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  for (const m of models) {
    providerCounts.set(
      String(m.provider),
      (providerCounts.get(String(m.provider)) ?? 0) + 1,
    );
    statusCounts.set(m.status, (statusCounts.get(m.status) ?? 0) + 1);
  }

  // Families are grouped from whatever the filters left, so the section
  // describes the table above it rather than the whole catalog.
  const families = getFamilies(rows).filter((f) => f.models.length > 1);

  return (
    <>
      <section className="space-y-4">
        <FilterBar
          providers={providers}
          statuses={statuses}
          activeProvider={activeProvider}
          activeStatus={activeStatus}
          activeOpenWeights={activeOpenWeights}
          providerCounts={providerCounts}
          statusCounts={statusCounts}
          openWeightsCount={models.filter((m) => m.openWeights).length}
          total={models.length}
        />

        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs text-fg-subtle">
            Showing{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {rows.length}
            </span>{" "}
            of{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {models.length}
            </span>{" "}
            models
          </p>
          {activeProvider || activeStatus || activeOpenWeights ? (
            <Link
              href={buildModelsHref({})}
              className="text-xs text-accent hover:underline"
            >
              Clear filters
            </Link>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <ModelTable models={rows} />
        ) : (
          <Empty>
            No models match this filter. Try clearing the provider, status or
            weights chip.
          </Empty>
        )}
      </section>

      {families.length > 0 ? (
        <section>
          <SectionHeader
            title="Families"
            subtitle="Ids sharing a name stem, so a model and its variants do not read as unrelated rows. No succession is implied — the source publishes none."
          />
          <Families families={families} limit={12} />
          {families.length > 12 ? (
            <p className="mt-3 text-xs text-fg-subtle">
              Showing the 12 largest of{" "}
              <span className="font-mono tabular-nums text-fg-muted">
                {families.length}
              </span>{" "}
              families in this view. Filter by provider to see the rest.
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

/**
 * Turn raw query-string values into the filter the page actually applies.
 *
 * A provider or status the catalog does not contain is not a filter — it is
 * resolved to null, so `?provider=Bogus` shows everything and, just as
 * importantly, no chip lights up claiming a filter that is not applied. The
 * status list is the one *present* in the catalog, which is stricter than
 * "is a known status": `?status=legacy` falls through while OpenRouter is
 * publishing no legacy rows.
 */
export function resolveModelFilters(
  raw: {
    provider: string | null;
    status: string | null;
    weights: string | null;
  },
  models: Model[],
): {
  activeProvider: string | null;
  activeStatus: ModelStatus | null;
  activeOpenWeights: boolean;
} {
  const providers = listProviders(models);
  const statuses = listStatuses(models);
  return {
    activeProvider: providers.some((p) => String(p) === raw.provider)
      ? raw.provider
      : null,
    activeStatus:
      statuses.find((s) => s === raw.status) ?? null,
    activeOpenWeights: raw.weights === "open",
  };
}
