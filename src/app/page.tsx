import Link from "next/link";
import { Badge, Card, Empty, SectionHeader, Stat } from "@/components/ui";
import { LeaderboardCard } from "@/components/benchmarks/LeaderboardCard";
import { ModelCard } from "@/components/models/ModelCard";
import { ProviderLabel } from "@/components/models/ProviderLabel";
import {
  getBenchmarkCount,
  getPrimaryLeaderboard,
  getScores,
  getUpdatedAt,
} from "@/lib/benchmarks";
import { formatDate, relativeTime } from "@/lib/format";
import { CATALOG_ENDPOINT } from "@/lib/model-catalog";
import {
  getAllModels,
  getCatalog,
  getLatestReleases,
  getProviders,
  getRetiring,
} from "@/lib/models";

/** The catalog is fetched; see src/lib/model-catalog.ts for the cache window. */
export const revalidate = 3600;

export default async function OverviewPage() {
  const catalog = await getCatalog();
  const models = await getAllModels();
  const providers = await getProviders();
  const latest = await getLatestReleases(6);
  const retiring = await getRetiring();
  const primary = getPrimaryLeaderboard();
  const updatedAt = getUpdatedAt();
  const scoreCount = (await getScores()).length;

  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-fg">
          What actually shipped
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          A dense snapshot of the frontier: which models exist, when they were
          listed, what they cost, how they score, and what the open-source world
          is starring this week. The catalog is fetched live; the benchmark
          scores are not. Every page says which of the two it is showing you.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Models tracked"
          value={models.length}
          hint={`${models.filter((m) => m.openWeights).length} appear to have open weights`}
        />
        <Stat label="Providers" value={providers.length} hint="distinct vendors" />
        <Stat
          label="Benchmarks"
          value={getBenchmarkCount()}
          hint={`${scoreCount} published scores`}
        />
        <Stat
          label="Catalog fetched"
          value={
            <span className="text-lg">
              {catalog.live ? formatDate(catalog.retrievedAt) : "—"}
            </span>
          }
          hint={
            catalog.live
              ? relativeTime(catalog.retrievedAt)
              : "live fetch failed; showing identities only"
          }
        />
      </section>

      <section>
        <SectionHeader
          title="Most recently listed"
          subtitle="The newest additions to OpenRouter's catalog — a listing date, not a vendor announcement date."
          action={
            <Link href="/models" className="text-xs text-accent hover:underline">
              Full catalog →
            </Link>
          }
        />
        {latest.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((m) => (
              <ModelCard key={m.id} model={m} />
            ))}
          </div>
        ) : (
          <Empty>
            No dated listings available — the live catalog could not be fetched.
          </Empty>
        )}
      </section>

      {/*
        There was a "Current flagships" section here, one model per provider.
        It cannot be rebuilt: flagship was a judgement typed into the old
        curated file, and OpenRouter publishes no lifecycle at all. Picking
        "newest per provider" instead would look like the same section and be
        an invention, so what stands here now is what the feed actually
        supports — where the numbers come from, and the one lifecycle fact it
        does publish.
      */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col">
          <SectionHeader
            title="How to read this catalog"
            subtitle="Every figure has a source, and it is not the vendor."
          />
          <Card className="flex flex-1 flex-col gap-3 p-5 text-sm leading-6 text-fg-muted">
            <p>
              The catalog comes from{" "}
              <a
                href={CATALOG_ENDPOINT}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-accent hover:underline"
              >
                openrouter.ai/api/v1/models
              </a>
              , fetched once an hour and shared by every visitor.
            </p>
            <ul className="space-y-1.5 text-xs leading-5">
              <li>
                Dates are when <span className="text-fg">OpenRouter listed</span>{" "}
                a model, not when the vendor announced it.
              </li>
              <li>
                Prices are <span className="text-fg">OpenRouter&rsquo;s</span>,
                not the vendor&rsquo;s list price.
              </li>
              <li>
                Open weights is{" "}
                <span className="text-fg">inferred</span> from a HuggingFace id
                on the listing, not read off a licence.
              </li>
              <li>
                There is <span className="text-fg">no lifecycle field</span>, so
                no model here is called a flagship. Nothing is ranked.
              </li>
              <li>
                <span className="font-mono tabular-nums text-fg">
                  {catalog.counts.supplement}
                </span>{" "}
                models OpenRouter does not carry — including Google&rsquo;s
                restricted-access Deep Think — are typed by hand and marked{" "}
                <Badge tone="warn">manual</Badge>.
              </li>
            </ul>
            <Link
              href="/sources"
              className="mt-auto inline-flex w-fit items-center rounded-md border border-border-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-accent hover:text-accent"
            >
              Full provenance →
            </Link>
          </Card>
        </div>

        <div className="flex flex-col">
          <SectionHeader
            title="Scheduled to retire"
            subtitle="The one lifecycle fact the feed publishes: a real retirement date."
          />
          <Card className="flex flex-1 flex-col gap-3 p-5">
            {retiring.length > 0 ? (
              <>
                <ul className="space-y-2">
                  {retiring.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-baseline justify-between gap-2 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-fg">{m.name}</span>
                        <ProviderLabel
                          provider={m.provider}
                          className="hidden shrink-0 text-[11px] text-fg-subtle sm:inline-flex"
                        />
                      </span>
                      <span className="shrink-0 font-mono tabular-nums text-bad">
                        {m.retiresOn}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-auto text-[11px] leading-4 text-fg-subtle">
                  Sentinel dates are discarded rather than shown: several z-ai
                  listings carry <span className="font-mono">2098-12-31</span> to
                  mean &ldquo;no expiry&rdquo;, and rendering that as a
                  retirement would be inventing a fact.
                </p>
              </>
            ) : (
              <Empty>
                No model in the catalog currently carries a retirement date.
              </Empty>
            )}
          </Card>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col">
          <SectionHeader
            title="Leaderboard"
            subtitle="Top 5 on the primary board."
            action={
              <Link
                href="/benchmarks"
                className="text-xs text-accent hover:underline"
              >
                All benchmarks →
              </Link>
            }
          />
          {primary ? (
            <LeaderboardCard leaderboard={primary} limit={5} />
          ) : (
            <Empty>No leaderboard data yet.</Empty>
          )}
        </div>

        <div className="flex flex-col">
          <SectionHeader
            title="Open source"
            subtitle="What developers are actually starring."
          />
          <Card className="flex flex-1 flex-col justify-between gap-4 p-5">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-fg">GitHub trending</h3>
              <p className="text-sm leading-6 text-fg-muted">
                Repositories climbing fastest right now, pulled live from the
                GitHub search API and filterable by language and time window.
                Like the model catalog it is fetched rather than typed — unlike
                the benchmark scores, which are still hand-curated and dated{" "}
                {updatedAt ? formatDate(updatedAt) : "unknown"}.
              </p>
            </div>
            <Link
              href="/github"
              className="inline-flex w-fit items-center rounded-md border border-border-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-accent hover:text-accent"
            >
              Browse trending repos →
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
}
