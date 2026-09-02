import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, SectionHeader } from "@/components/ui";
import {
  HEALTH_TITLE,
  HealthDot,
} from "@/components/leaderboards/HealthNote";
import { LeaderboardsBrowser } from "@/components/leaderboards/LeaderboardsBrowser";
import { LeaderboardsSection } from "@/components/leaderboards/LeaderboardsSection";
import { fetchAllLeaderboards } from "@/lib/leaderboards";
import { resolveResults, type ResolvedResult } from "@/lib/leaderboard-view";
import { getSources, isFragile } from "@/lib/sources";
import type { SourceHealth } from "@/lib/types";

/**
 * Matches LEADERBOARD_TTL_SECONDS. Next needs this as a literal, so it
 * restates DATA_TTL_SECONDS from src/lib/cache.ts rather than importing it.
 */
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Leaderboards",
  description:
    "Every public AI leaderboard we pull, grouped by source, each shown with what it measures, how much weight it deserves, who benefits from the ranking, and whether the data is live, stale or unavailable.",
};

/** A source with no fetcher result at all is still a source we promised. */
function emptyResult(sourceId: string): ResolvedResult {
  return {
    sourceId,
    boards: [],
    health: "unavailable",
    retrievedAt: new Date().toISOString(),
    upstreamUpdatedAt: null,
    error: "No result was returned for this source.",
  };
}

const HEALTH_ORDER: SourceHealth[] = ["live", "stale", "unavailable"];

export default async function LeaderboardsPage() {
  const sources = getSources();
  // The catalog join happens here, once, rather than inside each board card:
  // it is what used to make those cards async Server Components and pin the
  // page to per-request rendering. See src/lib/leaderboard-view.ts.
  const results = await resolveResults(await fetchAllLeaderboards());

  const byId = new Map(results.map((r) => [r.sourceId, r]));
  const rows = sources.map((source) => ({
    source,
    result: byId.get(source.id) ?? emptyResult(source.id),
  }));

  const healthCounts = HEALTH_ORDER.map((h) => ({
    health: h,
    count: rows.filter((r) => r.result.health === h).length,
  }));
  const fragileCount = sources.filter(isFragile).length;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Leaderboards
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          Eight public boards, fetched on a six-hour cycle and grouped by who
          publishes them. They do not measure the same thing and they do not
          agree with each other — that disagreement is the useful part. Every
          board is shown with the state of its data, because a number nobody
          could fetch this morning and a number fetched this morning are
          different claims.
        </p>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          Bars are scaled <span className="text-fg">within a single board</span>{" "}
          only. The units here are Elo, percent solved, percent resolved, tokens
          processed and a latent-variable index; nothing about them is
          comparable across boards, and no combined ranking is offered.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {healthCounts.map(({ health: h, count }) => (
          <Card key={h} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <HealthDot health={h} />
              <span className="text-xs font-medium text-fg">{h}</span>
              <span className="ml-auto font-mono text-lg tabular-nums text-fg">
                {count}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-fg-subtle">
              {HEALTH_TITLE[h]}
            </p>
          </Card>
        ))}
        <Card className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-fg">scraped</span>
            <span className="ml-auto font-mono text-lg tabular-nums text-fg">
              {fragileCount}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-fg-subtle">
            Read out of a page built for humans rather than an endpoint. These
            break on a redesign without anyone being told.
          </p>
        </Card>
      </div>

      {/*
        The fallback is all eight boards, unfiltered, rendered on the server.

        `useSearchParams` cannot run during a prerender, so React puts this
        into the static HTML and swaps in the browser's answer at hydration.
        Making it the real all-boards view rather than a skeleton means the
        common case — arriving with no `?source=` — paints the finished page
        from the CDN and is then replaced by something identical.

        One thing does legitimately change on that swap: the "retrieved by
        us" relative times. Prerendered, they are relative to the moment the
        page was built; re-rendered here, they are relative to now. The
        second is the true one on a page that can be served for six hours,
        and getting it right is exactly the honesty this page is for.
      */}
      <Suspense
        fallback={<LeaderboardsSection rows={rows} activeSource={null} />}
      >
        <LeaderboardsBrowser rows={rows} />
      </Suspense>

      <Card className="p-4">
        <SectionHeader title="How to read this page" />
        <ul className="space-y-1.5 text-xs leading-5 text-fg-muted">
          <li>
            <span className="text-good">live</span> means the board was fetched
            successfully the last time this page was rebuilt &mdash;
            &ldquo;retrieved by us&rdquo; on the board says when that was.{" "}
            <span className="text-warn">stale</span> means the live fetch failed
            and you are looking at a snapshot committed to this repository, with
            the date it was captured and the error that caused the fallback shown
            on the board itself.{" "}
            <span className="text-bad">unavailable</span> means the fetch failed
            and no snapshot exists, so nothing is shown — an empty space rather
            than old numbers dressed up as current ones.
          </li>
          <li>
            &ldquo;Board last changed upstream&rdquo; and &ldquo;retrieved by
            us&rdquo; are different facts. A board can be fetched successfully a
            minute ago and still be months out of date, and several of these are.
          </li>
          <li>
            Where a board publishes a confidence interval it is drawn on the bar,
            and rows whose intervals overlap a neighbour are marked. Those rows
            are tied; the rank number between them is an artefact of sorting, not
            a result.
          </li>
          <li>
            A model name links to the catalog only when we could resolve it to a
            model we track. Unresolved names are printed exactly as the board
            gave them.
          </li>
          <li>
            Full endpoints, licences, fetch methods and the case against each
            board are on{" "}
            <Link href="/sources" className="text-accent hover:underline">
              /sources
            </Link>
            .
          </li>
        </ul>
      </Card>
    </div>
  );
}
