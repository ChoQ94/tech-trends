import Link from "next/link";
import { HealthDot, HEALTH_TITLE } from "@/components/leaderboards/HealthNote";
import type { LeaderboardSource, SourceHealth } from "@/lib/types";

/**
 * Plain links, so every filtered view is a shareable, deep-linkable URL
 * rather than hidden component state. The page reads the query in the
 * browser now (see LeaderboardsBrowser) and is prerendered; these stayed
 * anchors regardless, because that is the half that mattered to a reader.
 */
export function SourceFilter({
  sources,
  health,
  boardCounts,
  activeSource,
  totalBoards,
}: {
  sources: readonly LeaderboardSource[];
  health: Map<string, SourceHealth>;
  boardCounts: Map<string, number>;
  activeSource: string | null;
  totalBoards: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-fg-subtle">
        Source
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip href="/leaderboards" active={!activeSource} count={totalBoards}>
          All boards
        </Chip>
        {sources.map((s) => (
          <Chip
            key={s.id}
            href={`?source=${encodeURIComponent(s.id)}`}
            active={activeSource === s.id}
            count={boardCounts.get(s.id) ?? 0}
            health={health.get(s.id) ?? "unavailable"}
          >
            {s.name.split(" — ")[0]}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  count,
  health,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  /** Omitted on the "All boards" chip, which stands for no single source. */
  health?: SourceHealth;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
        active
          ? "border-accent/50 bg-accent-dim/60 font-medium text-accent"
          : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
      }`}
    >
      {health ? (
        // The mark is shaped as well as coloured, and the state is spelled out
        // for assistive tech and on hover — a hue on its own would be the only
        // thing saying whether these numbers were fetched today.
        <span
          className="inline-flex items-center"
          title={`${health} — ${HEALTH_TITLE[health]}`}
        >
          <HealthDot health={health} className="h-2 w-2" />
          <span className="sr-only">{health}: </span>
        </span>
      ) : null}
      <span>{children}</span>
      <span className="font-mono tabular-nums text-fg-subtle">{count}</span>
    </Link>
  );
}
