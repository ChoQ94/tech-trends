import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { ProviderLabel } from "@/components/models/ProviderLabel";
import { DASH, formatCompact, formatDate, formatUSD } from "@/lib/format";
import type { ResolvedBoard } from "@/lib/leaderboard-view";
import type {
  LeaderboardEntry,
  LeaderboardSource,
  SourceHealth,
} from "@/lib/types";

/** Rows rendered before the tail is collapsed into a count. */
const ROW_LIMIT = 12;

/**
 * Bars are normalised against the spread inside this one board. Elo has no
 * meaningful zero and a percentage is not an Elo, so a bar drawn from zero —
 * or drawn against another board's range — would be a lie.
 */
function makeScale(values: number[]): (v: number) => number {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return () => 0;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (max === min) return () => 100;
  const floor = min - (max - min) * 0.25;
  return (v: number) =>
    Math.max(0, Math.min(100, ((v - floor) / (max - floor)) * 100));
}

function isCI(ci: LeaderboardEntry["ci"]): ci is { low: number; high: number } {
  return (
    !!ci &&
    Number.isFinite(ci.low) &&
    Number.isFinite(ci.high) &&
    ci.high >= ci.low
  );
}

function overlaps(a: LeaderboardEntry, b: LeaderboardEntry): boolean {
  if (!isCI(a.ci) || !isCI(b.ci)) return false;
  return a.ci.low <= b.ci.high && b.ci.low <= a.ci.high;
}

/** Scores read differently per unit; never add precision the board did not. */
function formatScore(score: number, unit: string): string {
  if (!Number.isFinite(score)) return DASH;
  if (/token/i.test(unit)) return formatCompact(score);
  const rounded = Math.round(score * 100) / 100;
  return unit.includes("%") ? `${rounded}%` : String(rounded);
}

/**
 * Synchronous on purpose. This used to `await getModelMap()` to turn a row's
 * slug into a real model name, which pinned the whole page to the server;
 * the join now happens once, before the data gets here, in
 * src/lib/leaderboard-view.ts. See ResolvedEntry.
 */
export function BoardCard({
  board,
  source,
  health,
}: {
  board: ResolvedBoard;
  source: LeaderboardSource;
  health: SourceHealth;
}) {
  const entries = board.entries ?? [];
  const shown = entries.slice(0, ROW_LIMIT);

  const bounds = entries.flatMap((e) =>
    isCI(e.ci) ? [e.score, e.ci.low, e.ci.high] : [e.score],
  );
  const scale = makeScale(bounds);

  // A confidence interval that overlaps a neighbour's means the ordering
  // between them is not a real ordering. Mark both rather than imply one.
  const tied = entries.map(
    (e, i) =>
      (i > 0 && overlaps(e, entries[i - 1])) ||
      (i < entries.length - 1 && overlaps(e, entries[i + 1])),
  );
  const anyTied = tied.some(Boolean);
  const anyCost = entries.some((e) => typeof e.costPerTask === "number");
  const stale = health === "stale";

  return (
    <Card
      className={`flex h-full flex-col p-4 ${
        stale ? "border-dashed border-warn/40 bg-surface/60" : ""
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="min-w-0 text-sm font-semibold tracking-tight text-fg">
          {board.name}
        </h4>
        <div className="flex shrink-0 items-center gap-2">
          {stale ? <Badge tone="warn">snapshot</Badge> : null}
          <a
            href={board.url || source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline"
          >
            Board ↗
          </a>
        </div>
      </div>

      <p className="mt-0.5 text-[11px] text-fg-subtle">
        Board updated{" "}
        <span className="font-mono tabular-nums text-fg-muted">
          {formatDate(board.updatedAt)}
        </span>
        <span aria-hidden> · </span>
        scores in <span className="text-fg-muted">{source.unit}</span>
      </p>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-fg-muted">
          This board returned no rows.
        </p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {shown.map((e, i) => {
            const provider = e.resolvedProvider;
            const label = e.label;
            const ci = isCI(e.ci) ? e.ci : null;
            return (
              <li
                key={`${e.rank}-${e.modelName}-${i}`}
                className="flex flex-col gap-1"
              >
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="w-6 shrink-0 text-right font-mono tabular-nums text-fg-subtle">
                    {e.rank}
                    {tied[i] ? (
                      <span
                        className="text-warn"
                        title="Confidence interval overlaps a neighbour — the ordering between them is not statistically meaningful."
                      >
                        *
                      </span>
                    ) : null}
                  </span>

                  <span className="min-w-0 flex-1 truncate" title={e.modelName}>
                    {provider ? (
                      // Only entries we could resolve to the catalog get a
                      // link; the rest render plainly rather than guess.
                      <Link
                        href={`/models?provider=${encodeURIComponent(String(provider))}`}
                        className="text-fg hover:text-accent hover:underline"
                      >
                        {label}
                      </Link>
                    ) : (
                      <span className="text-fg">{label}</span>
                    )}
                  </span>

                  {provider ? (
                    // The wrapper does the hiding: ProviderLabel sets its own
                    // display, and a `hidden` passed into it would lose to that.
                    <span className="hidden shrink-0 lg:block">
                      <ProviderLabel
                        provider={provider}
                        className="text-[11px] text-fg-subtle"
                      />
                    </span>
                  ) : null}

                  {anyCost ? (
                    <span
                      className="hidden w-16 shrink-0 text-right font-mono tabular-nums text-fg-subtle sm:inline"
                      title="Cost per task, as reported by the board."
                    >
                      {typeof e.costPerTask === "number"
                        ? formatUSD(e.costPerTask)
                        : DASH}
                    </span>
                  ) : null}

                  <span className="shrink-0 font-mono tabular-nums text-fg-muted">
                    {formatScore(e.score, source.unit)}
                  </span>
                </div>

                <div className="ml-8 flex items-center gap-2">
                  <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      // A live bar is solid accent; a snapshot bar is hatched.
                      // The two stay apart with colour removed, which they must:
                      // "fetched today" and "read off a committed snapshot" are
                      // different claims about the same number.
                      className={`absolute inset-y-0 left-0 rounded-full ${
                        stale ? "bar-snapshot" : "bg-accent"
                      }`}
                      style={{ width: `${scale(e.score)}%` }}
                    />
                    {ci ? (
                      <div
                        className="absolute inset-y-0 rounded-sm border-x border-fg-muted/70 bg-fg/10"
                        style={{
                          left: `${scale(ci.low)}%`,
                          width: `${Math.max(1.5, scale(ci.high) - scale(ci.low))}%`,
                        }}
                        title={`95% CI ${formatScore(ci.low, source.unit)} – ${formatScore(ci.high, source.unit)}`}
                      />
                    ) : null}
                  </div>
                  {ci ? (
                    <span className="hidden shrink-0 font-mono text-[10px] tabular-nums text-fg-subtle sm:inline">
                      {formatScore(ci.low, source.unit)}–
                      {formatScore(ci.high, source.unit)}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-auto space-y-1 pt-3 text-[11px] text-fg-subtle">
        {stale ? (
          <p>
            Hatched bars, and this card&rsquo;s dashed edge, mean the figures
            come from a committed snapshot rather than a live fetch.
          </p>
        ) : null}
        {entries.length > shown.length ? (
          <p>
            Showing top{" "}
            <span className="font-mono tabular-nums">{shown.length}</span> of{" "}
            <span className="font-mono tabular-nums">{entries.length}</span>{" "}
            entries.{" "}
            <a
              href={board.url || source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Full board ↗
            </a>
          </p>
        ) : null}
        {anyCost ? (
          <p>The middle column is cost per task in USD, as the board reports it.</p>
        ) : null}
        {anyTied ? (
          <p>
            <span className="text-warn">*</span> Confidence intervals overlap a
            neighbour. Those rows are statistically tied; the rank order between
            them is not a real ordering.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
