import Link from "next/link";
import { Callout, Card } from "@/components/ui";
import { BoardCard } from "@/components/leaderboards/BoardCard";
import { HealthBadge, HealthNote } from "@/components/leaderboards/HealthNote";
import {
  CredibilityBadge,
  FragileBadge,
} from "@/components/sources/badges";
import type { LeaderboardResult, LeaderboardSource } from "@/lib/types";

/**
 * One source and everything it published. The header carries the things a
 * reader needs *while* looking at the ranking — what it measures, in what
 * unit, how much weight it deserves, whether the operator has a stake in the
 * outcome, and whether these numbers were actually fetched today.
 */
export function SourceGroup({
  source,
  result,
}: {
  source: LeaderboardSource;
  result: LeaderboardResult;
}) {
  const boards = result.boards ?? [];

  return (
    <section
      id={`board-${source.id}`}
      className="scroll-mt-20 space-y-4"
      aria-labelledby={`board-${source.id}-title`}
    >
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3
              id={`board-${source.id}-title`}
              className="text-base font-semibold tracking-tight text-fg"
            >
              {source.name}
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-muted">
              {source.measures}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <HealthBadge health={result.health} />
            <CredibilityBadge
              credibility={source.credibility}
              note={source.credibilityNote}
            />
            <FragileBadge source={source} />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          <span className="text-fg-subtle">
            Unit <span className="font-mono text-fg-muted">{source.unit}</span>
          </span>
          <span className="text-fg-subtle">
            Cadence <span className="text-fg-muted">{source.cadence}</span>
          </span>
          <Link
            href={`/sources#${source.id}`}
            className="text-accent hover:underline"
          >
            How we fetch it, and what to distrust →
          </Link>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            {new URL(source.url).host} ↗
          </a>
        </div>

        {source.conflictOfInterest ? (
          <div className="mt-3">
            <Callout label="Conflict of interest" tone="warn">
              {source.conflictOfInterest}
            </Callout>
          </div>
        ) : null}

        <HealthNote result={result} />
      </Card>

      {boards.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {boards.map((board) => (
            <BoardCard
              key={`${source.id}-${board.id}`}
              board={board}
              source={source}
              health={result.health}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-fg-muted">
          No boards to show for this source.{" "}
          {result.health === "unavailable"
            ? "Nothing was fetched and no snapshot is committed, so this space is deliberately empty rather than filled with old numbers."
            : "The source returned an empty payload."}
        </p>
      )}
    </section>
  );
}
