import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, SectionHeader } from "@/components/ui";
import {
  HEALTH_LABEL,
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
  title: "리더보드",
  description:
    "우리가 가져오는 공개 AI 리더보드 전부를 출처별로 묶었습니다. 보드마다 무엇을 측정하는지, 얼마나 무게를 둘 만한지, 그 순위로 누가 이득을 보는지, 그리고 데이터가 실시간인지 스냅샷인지 없음인지를 함께 표시합니다.",
};

/** A source with no fetcher result at all is still a source we promised. */
function emptyResult(sourceId: string): ResolvedResult {
  return {
    sourceId,
    boards: [],
    health: "unavailable",
    retrievedAt: new Date().toISOString(),
    upstreamUpdatedAt: null,
    error: "이 출처에서 반환된 결과가 없습니다.",
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
          리더보드
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          공개 보드 여덟 개를 6시간 주기로 가져와 발행 주체별로 묶었습니다. 이
          보드들은 서로 다른 것을 측정하고 서로 일치하지도 않습니다 &mdash; 그
          불일치가 바로 쓸모 있는 부분입니다. 모든 보드에는 데이터 상태를 함께
          표시합니다. 오늘 아침에 아무도 가져오지 못한 숫자와 오늘 아침에 가져온
          숫자는 서로 다른 주장이기 때문입니다.
        </p>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          막대는{" "}
          <span className="text-fg">보드 하나 안에서만</span> 스케일을 맞춥니다.
          여기 쓰이는 단위는 Elo, 푼 문제 비율(%), 해결한 이슈 비율(%), 처리한
          tokens 수, 잠재변수 지수입니다. 이 중 어느 것도 보드 간 비교가 되지
          않으며, 합산 순위도 제공하지 않습니다.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {healthCounts.map(({ health: h, count }) => (
          <Card key={h} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <HealthDot health={h} />
              <span className="text-xs font-medium text-fg">
                {HEALTH_LABEL[h]}
              </span>
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
            <span className="text-xs font-medium text-fg">스크레이핑</span>
            <span className="ml-auto font-mono text-lg tabular-nums text-fg">
              {fragileCount}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-fg-subtle">
            엔드포인트가 아니라 사람이 보라고 만든 페이지에서 읽어 옵니다.
            페이지가 개편되면 아무런 통보 없이 깨집니다.
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
        <SectionHeader title="이 페이지를 읽는 법" />
        <ul className="space-y-1.5 text-xs leading-5 text-fg-muted">
          <li>
            <span className="text-good">실시간</span>은 이 페이지를 마지막으로
            다시 빌드했을 때 보드를 성공적으로 가져왔다는 뜻이며, 그 시각은
            보드의 &ldquo;가져온 시각&rdquo;에 적혀 있습니다.{" "}
            <span className="text-warn">스냅샷</span>은 실시간 가져오기가 실패해
            이 저장소에 커밋된 스냅샷을 보고 있다는 뜻입니다. 캡처한 날짜와
            폴백을 유발한 오류는 보드 자체에 표시됩니다.{" "}
            <span className="text-bad">없음</span>은 가져오기가 실패했고 스냅샷도
            없어서 아무것도 보여주지 않는다는 뜻입니다 &mdash; 지난 숫자를 현재인
            양 꾸며 두는 대신 빈자리로 남깁니다.
          </li>
          <li>
            &ldquo;원본 최종 변경&rdquo;과 &ldquo;가져온 시각&rdquo;은 서로 다른
            사실입니다. 1분 전에 성공적으로 가져온 보드라도 몇 달 전 내용
            그대로일 수 있고, 여기 있는 보드 중에도 그런 것이 여럿 있습니다.
          </li>
          <li>
            보드가 신뢰구간을 공개한 경우 막대 위에 함께 그리고, 구간이 옆 행과
            겹치는 행에는 표시를 답니다. 그런 행들은 동률이며, 그 사이의 순위
            번호는 정렬이 만들어 낸 부산물일 뿐 결과가 아닙니다.
          </li>
          <li>
            모델 이름에 카탈로그 링크가 걸리는 것은 우리가 추적하는 모델로 연결할
            수 있었던 경우뿐입니다. 연결하지 못한 이름은 보드가 준 그대로
            표시합니다.
          </li>
          <li>
            전체 엔드포인트, 라이선스, 수집 방식, 그리고 각 보드를 의심해야 할
            이유는{" "}
            <Link href="/sources" className="text-accent hover:underline">
              /sources
            </Link>
            에 있습니다.
          </li>
        </ul>
      </Card>
    </div>
  );
}
