import Link from "next/link";
import { Card, Empty } from "@/components/ui";
import { SourceFilter } from "@/components/leaderboards/SourceFilter";
import { SourceGroup } from "@/components/leaderboards/SourceGroup";
import type { ResolvedResult } from "@/lib/leaderboard-view";
import type { LeaderboardSource } from "@/lib/types";

/**
 * One source paired with whatever its fetcher returned. Built on the server
 * so that a source with no result at all still gets a row — see emptyResult
 * in the page, which stamps a timestamp and must therefore not run twice.
 */
export interface LeaderboardRow {
  source: LeaderboardSource;
  result: ResolvedResult;
}

/**
 * Everything on /leaderboards that the `?source=` chip changes: the chips
 * themselves, the conflict-of-interest roll-up (shown only in the all-boards
 * view, where it is the reader's one chance to see every stake at once) and
 * the board groups.
 *
 * Rendered twice, deliberately: once on the server with no filter as the
 * Suspense fallback, so the prerendered HTML is all eight boards, and once in
 * the browser by LeaderboardsBrowser with the filter the URL asks for. Same
 * function both times, so the two cannot drift.
 */
export function LeaderboardsSection({
  rows,
  activeSource,
}: {
  rows: LeaderboardRow[];
  /** Already resolved against the registry; see resolveSourceFilter. */
  activeSource: string | null;
}) {
  const sources = rows.map((r) => r.source);
  const health = new Map(rows.map((r) => [r.source.id, r.result.health]));
  const boardCounts = new Map(
    rows.map((r) => [r.source.id, r.result.boards.length]),
  );
  const totalBoards = rows.reduce((n, r) => n + r.result.boards.length, 0);
  const conflicts = rows.filter((r) => r.source.conflictOfInterest);
  const visible = activeSource
    ? rows.filter((r) => r.source.id === activeSource)
    : rows;

  return (
    <>
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
    </>
  );
}

/**
 * An unknown `?source=` is not a filter.
 *
 * It resolves to null, so `?source=bogus` shows every board and no chip
 * lights up claiming a filter that is not applied — the same rule the chips
 * have always followed, now applied in the browser instead of on the server.
 */
export function resolveSourceFilter(
  raw: string | null,
  rows: LeaderboardRow[],
): string | null {
  return rows.some((r) => r.source.id === raw) ? raw : null;
}
