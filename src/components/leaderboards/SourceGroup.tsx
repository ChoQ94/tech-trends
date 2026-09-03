import Link from "next/link";
import { Callout, Card } from "@/components/ui";
import { BoardCard } from "@/components/leaderboards/BoardCard";
import { HealthBadge, HealthNote } from "@/components/leaderboards/HealthNote";
import {
  CredibilityBadge,
  FragileBadge,
} from "@/components/sources/badges";
import type { ResolvedResult } from "@/lib/leaderboard-view";
import type { LeaderboardSource } from "@/lib/types";

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
  result: ResolvedResult;
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
            단위 <span className="font-mono text-fg-muted">{source.unit}</span>
          </span>
          <span className="text-fg-subtle">
            갱신 주기 <span className="text-fg-muted">{source.cadence}</span>
          </span>
          <Link
            href={`/sources#${source.id}`}
            className="text-accent hover:underline"
          >
            어떻게 가져오는지, 무엇을 의심해야 하는지 →
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
            <Callout label="이해충돌" tone="warn">
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
          이 출처에서 보여줄 보드가 없습니다.{" "}
          {result.health === "unavailable"
            ? "가져온 것도 없고 커밋된 스냅샷도 없어서, 지난 숫자로 채우는 대신 이 자리를 일부러 비워 둡니다."
            : "출처가 빈 페이로드를 반환했습니다."}
        </p>
      )}
    </section>
  );
}
