import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Empty, SectionHeader } from "@/components/ui";
import { Families } from "@/components/models/Families";
import { FilterBar, buildModelsHref } from "@/components/models/FilterBar";
import { ModelTable } from "@/components/models/ModelTable";
import { formatDate, relativeTime } from "@/lib/format";
import { CATALOG_ENDPOINT } from "@/lib/model-catalog";
import {
  filterModels,
  getAllModels,
  getCatalog,
  getFamilies,
  getProviders,
  getStatuses,
} from "@/lib/models";

/** Matches the catalog's own cache window; see src/lib/model-catalog.ts. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Models",
  description:
    "Every model OpenRouter lists, fetched live: provider, listing date, context window, max output, OpenRouter's price per million tokens and whether weights appear to be published.",
};

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const catalog = await getCatalog();
  const all = await getAllModels();
  const providers = await getProviders();
  const statuses = await getStatuses();

  const providerParam = first(sp.provider);
  const statusParam = first(sp.status);
  const openWeights = first(sp.weights) === "open";

  // Unknown values fall through filterModels as "no filter"; reflect that in
  // the chips so the UI never claims a filter that is not applied.
  const activeProvider = providers.some((p) => p === providerParam)
    ? providerParam
    : null;
  const activeStatus = statuses.some((s) => s === statusParam)
    ? statusParam
    : null;

  const rows = await filterModels({
    provider: activeProvider,
    status: activeStatus,
    openWeights,
  });

  const providerCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  for (const m of all) {
    providerCounts.set(
      String(m.provider),
      (providerCounts.get(String(m.provider)) ?? 0) + 1,
    );
    statusCounts.set(m.status, (statusCounts.get(m.status) ?? 0) + 1);
  }

  // Families are grouped from whatever the filters left, so the section
  // describes the table above it rather than the whole catalog.
  const families = getFamilies(rows).filter((f) => f.models.length > 1);
  const { counts } = catalog;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Model catalog
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-fg-muted">
          {all.length} models across {providers.length} providers, fetched from{" "}
          <a
            href={CATALOG_ENDPOINT}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-accent hover:underline"
          >
            openrouter.ai/api/v1/models
          </a>{" "}
          and cached for an hour. A dash means the figure is not published,
          never a guess.
        </p>

        <Callout label="Where these numbers come from" tone="warn">
          Every figure here has a source that is{" "}
          <span className="text-fg">not the vendor</span>, and each is weaker
          than it looks:{" "}
          <span className="text-fg">the date is OpenRouter&rsquo;s listing
          date</span>
          , not the vendor&rsquo;s announcement — they differ by days;{" "}
          <span className="text-fg">the price is OpenRouter&rsquo;s</span> price
          to route the model, not the vendor&rsquo;s list price;{" "}
          <span className="text-fg">open weights is inferred</span> from a
          HuggingFace id on the listing rather than read off a licence; and
          OpenRouter publishes{" "}
          <span className="text-fg">no lifecycle field at all</span>, so status
          is <span className="text-fg">unclassified</span> unless a real
          retirement date says otherwise. Nothing here is ranked, because no
          source we hold ranks it.
        </Callout>

        {catalog.live ? (
          <p className="text-xs text-fg-subtle">
            Retrieved{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {formatDate(catalog.retrievedAt)}
            </span>{" "}
            ({relativeTime(catalog.retrievedAt)}) ·{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {counts.listed}
            </span>{" "}
            rows returned, of which{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {counts.variantsFolded}
            </span>{" "}
            <span className="font-mono">:free</span>/
            <span className="font-mono">:batch</span> billing variants were
            folded into the model they price and{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {counts.aliasPointers}
            </span>{" "}
            <span className="font-mono">~vendor/*-latest</span> moving pointers
            were set aside, because each resolves to whichever model the vendor
            currently points it at ·{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {counts.supplement}
            </span>{" "}
            models OpenRouter does not carry are added by hand and marked{" "}
            <span className="text-warn">manual</span>.
          </p>
        ) : (
          <Callout label="The live catalog could not be fetched" tone="bad">
            {catalog.error} What is shown below is not the catalog: it is the
            identity table from{" "}
            <span className="font-mono">data/model-id-map.json</span> plus the{" "}
            {counts.supplement} hand-recorded models, so that{" "}
            <Link href="/benchmarks" className="text-accent hover:underline">
              /benchmarks
            </Link>{" "}
            still resolves its scores. Every specification and price on this
            page is blank because we do not have one, not because the model
            lacks one.
          </Callout>
        )}
      </header>

      <section className="space-y-4">
        <FilterBar
          providers={providers}
          statuses={statuses}
          activeProvider={activeProvider}
          activeStatus={activeStatus}
          activeOpenWeights={openWeights}
          providerCounts={providerCounts}
          statusCounts={statusCounts}
          openWeightsCount={all.filter((m) => m.openWeights).length}
          total={all.length}
        />

        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs text-fg-subtle">
            Showing{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {rows.length}
            </span>{" "}
            of{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {all.length}
            </span>{" "}
            models
          </p>
          {activeProvider || activeStatus || openWeights ? (
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
    </div>
  );
}
