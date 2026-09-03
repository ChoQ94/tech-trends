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

/** Display label per health state. The enum value itself is unchanged. */
export const HEALTH_LABEL: Record<SourceHealth, string> = {
  live: "실시간",
  stale: "스냅샷",
  unavailable: "없음",
};

export const HEALTH_TITLE: Record<SourceHealth, string> = {
  live: "이 페이지를 마지막으로 다시 빌드했을 때 성공적으로 가져왔습니다.",
  stale: "실시간 가져오기가 실패했습니다. 이 숫자들은 저장소에 커밋된 스냅샷에서 나온 것입니다.",
  unavailable: "실시간 가져오기가 실패했고 커밋된 스냅샷도 없어서 보여줄 것이 없습니다.",
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
      {HEALTH_LABEL[health]}
    </Badge>
  );
}

function Timestamp({ value }: { value: string | null }) {
  if (!value) return <span className="text-fg-subtle">미공개</span>;
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
        <dt className="text-fg-subtle">원본 최종 변경</dt>
        <dd>
          <Timestamp value={upstreamUpdatedAt} />
        </dd>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <dt className="text-fg-subtle">
          {health === "stale" ? "스냅샷 캡처 시점" : "가져온 시각"}
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
          ? "실시간 가져오기 실패 — 현재 데이터가 아니라 이 저장소에 커밋된 스냅샷을 보여주고 있습니다."
          : "실시간 가져오기가 실패했고 커밋된 스냅샷도 없습니다 — 보여줄 것이 없습니다."}
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
