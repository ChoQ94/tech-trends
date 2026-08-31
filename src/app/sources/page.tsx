import type { Metadata } from "next";
import Link from "next/link";
import { Card, SectionHeader } from "@/components/ui";
import {
  CuratedDataEntry,
  GitHubTrendingEntry,
  ModelCatalogEntry,
} from "@/components/sources/OtherSources";
import { SourceEntry } from "@/components/sources/SourceEntry";
import { getSources, isFragile } from "@/lib/sources";

export const metadata: Metadata = {
  title: "Sources",
  description:
    "Where every number on this site comes from: the exact endpoint called for each leaderboard, how it is fetched, what licence it carries, how much it can be trusted, and which figures are hand-curated rather than live.",
};

export default function SourcesPage() {
  const sources = getSources();
  const published = sources.filter((s) => !isFragile(s));
  const fragile = sources.filter(isFragile);

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Sources
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          Every number on this site, the exact address it came from, and how
          much weight it can carry.
        </p>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          The single most important distinction here is{" "}
          <span className="text-fg">how</span> a number is fetched. Some
          operators publish an endpoint meant for callers — a JSON API, a static
          JSON file, a CSV download. Those are a contract: they have a stable
          shape, they change on notice, and when one breaks it breaks loudly and
          we can tell you. The rest are pages built for human eyes, from which we
          pick the numbers out of the markup or the JSON buried inside it. That
          is not a contract. A redesign, a renamed field, a switch to
          client-side rendering, and the numbers stop arriving — or worse, keep
          arriving and quietly stop changing, with nobody notified. So: the
          sources in the first group below are ones you can trust to be current
          when the page says they are current, and the second group are ones
          where &ldquo;current&rdquo; is a hope. Both groups show live fetch
          state on{" "}
          <Link href="/leaderboards" className="text-accent hover:underline">
            /leaderboards
          </Link>
          , which is where you should check before quoting any of them.
        </p>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          Below the leaderboards, three more data sets. GitHub trending and the
          model catalog are both <span className="text-good">live</span> — the
          catalog moved off a hand-typed file onto OpenRouter&rsquo;s models
          API, which is why it is described here as an endpoint rather than as
          a transcription. The benchmark scores are still{" "}
          <span className="text-warn">not fetched at all</span>. The two now sit
          side by side on{" "}
          <Link href="/benchmarks" className="text-accent hover:underline">
            /benchmarks
          </Link>
          , one fetched and one typed, so which is which is worth knowing before
          you quote either.
        </p>
      </header>

      <nav aria-label="Sources index">
        <Card className="p-4">
          <h2 className="text-xs uppercase tracking-wide text-fg-subtle">
            On this page
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {sources.map((s) => (
              <li key={s.id}>
                <Link href={`#${s.id}`} className="text-accent hover:underline">
                  {s.name.split(" — ")[0]}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="#github-trending"
                className="text-accent hover:underline"
              >
                GitHub trending
              </Link>
            </li>
            <li>
              <Link
                href="#model-catalog"
                className="text-accent hover:underline"
              >
                Model catalog
              </Link>
            </li>
            <li>
              <Link href="#curated" className="text-accent hover:underline">
                Benchmark scores
              </Link>
            </li>
          </ul>
        </Card>
      </nav>

      <section className="space-y-4">
        <SectionHeader
          title="Published endpoints"
          subtitle="json-api, static-json and csv — interfaces the operator publishes for callers. When one of these breaks, it breaks visibly."
        />
        <div className="space-y-4">
          {published.map((s) => (
            <SourceEntry key={s.id} source={s} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Scraped pages"
          subtitle="scrape-embedded-json and scrape-html — us reading a page built for humans. No contract, no notice, and a redesign can stop the numbers updating without any error being raised."
        />
        <div className="space-y-4">
          {fragile.map((s) => (
            <SourceEntry key={s.id} source={s} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Not leaderboards"
          subtitle="The rest of the site's numbers. Two are fetched; the third is a file somebody typed."
        />
        <div className="space-y-4">
          <GitHubTrendingEntry />
          <ModelCatalogEntry />
          <CuratedDataEntry />
        </div>
      </section>

      <section>
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-fg">How to update</h2>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-fg-muted">
            <li>
              The model catalog is <span className="text-good">fetched</span>,
              not edited — see{" "}
              <span className="font-mono text-fg">src/lib/model-catalog.ts</span>
              . Two files beside it are hand-maintained:{" "}
              <span className="font-mono text-fg">data/model-id-map.json</span>,
              which maps the former curated ids onto OpenRouter slugs and is
              what keeps every benchmark score and leaderboard row joined, and{" "}
              <span className="font-mono text-fg">
                data/models-supplement.json
              </span>
              , the handful of models OpenRouter does not list.
            </li>
            <li>
              <span className="font-mono text-fg">data/benchmarks.json</span> —
              benchmark definitions, scores and the static leaderboards on{" "}
              <Link href="/benchmarks" className="text-accent hover:underline">
                /benchmarks
              </Link>
              . Conforms to <span className="font-mono">BenchmarkData</span>.
              Bump its <span className="font-mono">updatedAt</span> whenever you
              touch a score.
            </li>
            <li>
              <span className="font-mono text-fg">
                data/leaderboards-snapshot.json
              </span>{" "}
              — last-known-good boards per source id. This is what a{" "}
              <span className="text-warn">stale</span> board falls back to, and
              each entry carries its own{" "}
              <span className="font-mono">capturedAt</span> so the page can say
              how old it is rather than passing it off as live.
            </li>
            <li>
              The registry itself —{" "}
              <span className="font-mono text-fg">src/lib/sources.ts</span> — is
              what this page renders. Adding a source there, with its endpoint,
              licence and credibility note, is what makes it appear here.
            </li>
            <li>
              After editing, run{" "}
              <span className="font-mono text-fg">npx tsc --noEmit</span>. The
              JSON is imported at build time, so a deploy needs a rebuild to
              pick up a change — the OpenRouter catalog is not, and refreshes on
              its own hourly cache.
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
