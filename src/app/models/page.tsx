import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "@/components/ui";
import { ModelsBrowser } from "@/components/models/ModelsBrowser";
import { ModelsSection } from "@/components/models/ModelsSection";
import { formatDate, relativeTime } from "@/lib/format";
import { CATALOG_ENDPOINT } from "@/lib/model-catalog";
import { getAllModels, getCatalog, getProviders } from "@/lib/models";

/**
 * Matches the catalog's own cache window; see src/lib/model-catalog.ts. Next
 * needs this as a literal, so it restates DATA_TTL_SECONDS from
 * src/lib/cache.ts rather than importing it.
 */
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Models",
  description:
    "Every model OpenRouter lists, fetched live: provider, listing date, context window, max output, OpenRouter's price per million tokens and whether weights appear to be published.",
};

export default async function ModelsPage() {
  const catalog = await getCatalog();
  const all = await getAllModels();
  const providers = await getProviders();
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
          and cached for six hours. A dash means the figure is not published,
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

      {/*
        The fallback is the whole catalog, unfiltered, rendered on the server.

        `useSearchParams` cannot run during a prerender, so React renders this
        fallback into the static HTML and swaps in the browser's answer at
        hydration. Making the fallback the real unfiltered view rather than a
        skeleton means the common case — arriving at /models with no query
        string — paints the finished page from the CDN and then replaces it
        with something byte-identical: no skeleton, no reflow, nothing to
        watch. A shared link that does carry a filter shows the full catalog
        for the moment before hydration, which is the one case we cannot
        prerender our way out of without asking the server to render per
        visitor again — which is the cost we came here to remove.
      */}
      <Suspense
        fallback={
          <ModelsSection
            models={all}
            activeProvider={null}
            activeStatus={null}
            activeOpenWeights={false}
          />
        }
      >
        <ModelsBrowser models={all} />
      </Suspense>
    </div>
  );
}
