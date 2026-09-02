import { Badge, type BadgeTone } from "@/components/ui";
import { formatDate, relativeTime } from "@/lib/format";
import type { LeaderboardResult, SourceHealth } from "@/lib/types";

/* Health is part of reading a board, not a footnote. A number nobody could
 * fetch, and a number fetched three weeks ago, are different claims. */

const HEALTH_TONE: Record<SourceHealth, BadgeTone> = {
  live: "good",
  stale: "warn",
  unavailable: "bad",
};

export const HEALTH_TITLE: Record<SourceHealth, string> = {
  live: "Fetched successfully the last time this page was rebuilt.",
  stale: "The live fetch failed. These numbers come from a snapshot committed to the repo.",
  unavailable: "The live fetch failed and no snapshot is committed, so there is nothing to show.",
};

/**
 * Shape, not just hue. Live is a filled disc, stale a hollow ring, unavailable
 * a diamond — so the three states stay apart for a reader who cannot separate
 * mint from amber from red, and in the one place (the source filter chips)
 * where the mark appears without its word next to it.
 */
const HEALTH_SHAPE: Record<SourceHealth, string> = {
  live: "rounded-full bg-good",
  stale: "rounded-full border border-warn bg-transparent",
  unavailable: "rounded-[1px] rotate-45 bg-bad",
};

export function HealthDot({
  health,
  className = "h-2 w-2",
}: {
  health: SourceHealth;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${className} ${HEALTH_SHAPE[health]}`}
    />
  );
}

export function HealthBadge({ health }: { health: SourceHealth }) {
  return (
    <Badge tone={HEALTH_TONE[health]} title={HEALTH_TITLE[health]}>
      <HealthDot health={health} className="h-2 w-2" />
      {health}
    </Badge>
  );
}

function Timestamp({ value }: { value: string | null }) {
  if (!value) return <span className="text-fg-subtle">not published</span>;
  return (
    <span className="font-mono tabular-nums text-fg">
      {formatDate(value)}{" "}
      <span className="text-fg-subtle">({relativeTime(value)})</span>
    </span>
  );
}

/**
 * The two timestamps say different things and are kept apart deliberately:
 * `upstreamUpdatedAt` is when the board itself last changed, `retrievedAt`
 * is when we pulled it. A board can be freshly fetched and months stale.
 */
export function HealthNote({ result }: { result: LeaderboardResult }) {
  const { health, error, retrievedAt, upstreamUpdatedAt } = result;

  const timestamps = (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <dt className="text-fg-subtle">Board last changed upstream</dt>
        <dd>
          <Timestamp value={upstreamUpdatedAt} />
        </dd>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <dt className="text-fg-subtle">
          {health === "stale" ? "Snapshot captured" : "Retrieved by us"}
        </dt>
        <dd>
          <Timestamp value={retrievedAt} />
        </dd>
      </div>
    </dl>
  );

  if (health === "live") {
    return <div className="mt-3">{timestamps}</div>;
  }

  const tone =
    health === "stale"
      ? "border-warn/30 bg-warn/5 text-warn"
      : "border-bad/30 bg-bad/5 text-bad";

  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 ${tone}`}>
      <p className="text-xs font-medium">
        {health === "stale"
          ? "Live fetch failed — showing a snapshot committed to this repo, not current data."
          : "Live fetch failed and no snapshot is committed — nothing to show."}
      </p>
      {error ? (
        <p className="mt-1 break-words font-mono text-[11px] leading-4 text-fg-muted">
          {error}
        </p>
      ) : null}
      {health === "stale" ? (
        <div className="mt-2 text-fg-muted">{timestamps}</div>
      ) : null}
    </div>
  );
}
