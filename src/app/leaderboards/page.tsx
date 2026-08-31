import type { Metadata } from "next";
import Link from "next/link";
import { Card, Empty, SectionHeader } from "@/components/ui";
import {
  HEALTH_TITLE,
  HealthDot,
} from "@/components/leaderboards/HealthNote";
import { SourceFilter } from "@/components/leaderboards/SourceFilter";
import { SourceGroup } from "@/components/leaderboards/SourceGroup";
import { fetchAllLeaderboards } from "@/lib/leaderboards";
import { getSources, isFragile } from "@/lib/sources";
import type { LeaderboardResult, SourceHealth } from "@/lib/types";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Leaderboards",
  description:
    "Every public AI leaderboard we pull, grouped by source, each shown with what it measures, how much weight it deserves, who benefits from the ranking, and whether the data is live, stale or unavailable.",
};

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** A source with no fetcher result at all is still a source we promised. */
function emptyResult(sourceId: string): LeaderboardResult {
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

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sources = getSources();
  const results = await fetchAllLeaderboards();

  const byId = new Map(results.map((r) => [r.sourceId, r]));
  const rows = sources.map((source) => ({
    source,
    result: byId.get(source.id) ?? emptyResult(source.id),
  }));

  // An unknown ?source= is not a filter; the chips reflect what is applied.
  const sourceParam = first(sp.source);
  const activeSource = sources.some((s) => s.id === sourceParam)
    ? sourceParam
    : null;
  const visible = activeSource
    ? rows.filter((r) => r.source.id === activeSource)
    : rows;

  const health = new Map(rows.map((r) => [r.source.id, r.result.health]));
  const boardCounts = new Map(
    rows.map((r) => [r.source.id, r.result.boards.length]),
  );
  const totalBoards = rows.reduce((n, r) => n + r.result.boards.length, 0);
  const healthCounts = HEALTH_ORDER.map((h) => ({
    health: h,
    count: rows.filter((r) => r.result.health === h).length,
  }));
  const fragileCount = sources.filter(isFragile).length;
  const conflicts = rows.filter((r) => r.source.conflictOfInterest);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Leaderboards
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          Eight public boards, fetched at request time and grouped by who
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

      <SourceFilter
        sources={sources}
        health={health}
        boardCounts={boardCounts}
        activeSource={activeSource}
        totalBoards={totalBoards}
      />

      {conflicts.length > 0 && !activeSource ? (
        <Card className="border-warn/30 p-4">
          <h2 className="text-sm font-semibold text-fg">
            Who benefits from these rankings
          </h2>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-fg-muted">
            {conflicts.map(({ source }) => (
              <li key={source.id}>
                <Link
                  href={`#board-${source.id}`}
                  className="text-warn hover:underline"
                >
                  {source.name}
                </Link>{" "}
                — {source.conflictOfInterest}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {visible.length === 0 ? (
        <Empty>No source matches that filter.</Empty>
      ) : (
        <div className="space-y-10">
          {visible.map(({ source, result }) => (
            <SourceGroup key={source.id} source={source} result={result} />
          ))}
        </div>
      )}

      <Card className="p-4">
        <SectionHeader title="How to read this page" />
        <ul className="space-y-1.5 text-xs leading-5 text-fg-muted">
          <li>
            <span className="text-good">live</span> means the board was fetched
            successfully for this page load.{" "}
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
