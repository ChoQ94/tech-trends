import { Card } from "@/components/ui";
import { ProviderLabel } from "@/components/models/ProviderLabel";
import { leaderboardEntryLabel } from "@/lib/benchmarks";
import { formatDate } from "@/lib/format";
import { getModelMap } from "@/lib/models";
import type { Leaderboard } from "@/lib/types";

/**
 * Bars are normalized against the spread inside this leaderboard only.
 * Elo-style scores have a meaningless zero, so a bar drawn from 0 would make
 * every model look identical.
 */
function barWidth(score: number, min: number, max: number): number {
  if (max === min) return 100;
  const floor = min - (max - min) * 0.25;
  return Math.max(6, Math.min(100, ((score - floor) / (max - floor)) * 100));
}

export async function LeaderboardCard({
  leaderboard,
  limit,
}: {
  leaderboard: Leaderboard;
  limit?: number;
}) {
  const modelMap = await getModelMap();
  const entries = limit
    ? leaderboard.entries.slice(0, limit)
    : leaderboard.entries;
  const scores = leaderboard.entries.map((e) => e.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-fg">
          {leaderboard.name}
        </h3>
        <a
          href={leaderboard.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline"
        >
          출처 ↗
        </a>
      </div>
      <p className="mt-0.5 text-xs text-fg-subtle">
        업데이트{" "}
        <span className="font-mono tabular-nums">
          {formatDate(leaderboard.updatedAt)}
        </span>
      </p>

      <ol className="mt-4 space-y-2.5">
        {entries.map((e) => {
          const model = e.modelId ? modelMap.get(e.modelId) : undefined;
          return (
            <li key={`${e.rank}-${e.modelName}`} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2 text-xs">
                <span className="w-5 shrink-0 text-right font-mono tabular-nums text-fg-subtle">
                  {e.rank}
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-fg"
                  title={e.modelName}
                >
                  {leaderboardEntryLabel(e, modelMap)}
                </span>
                {model ? (
                  // The wrapper does the hiding: ProviderLabel sets its own
                  // display, and a `hidden` passed into it would lose to that.
                  <span className="hidden shrink-0 sm:block">
                    <ProviderLabel
                      provider={model.provider}
                      className="text-[11px] text-fg-subtle"
                    />
                  </span>
                ) : null}
                <span className="shrink-0 font-mono tabular-nums text-fg-muted">
                  {e.score}
                </span>
              </div>
              <div
                className="ml-7 h-1.5 overflow-hidden rounded-full bg-surface-2"
                role="presentation"
              >
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${barWidth(e.score, min, max)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
