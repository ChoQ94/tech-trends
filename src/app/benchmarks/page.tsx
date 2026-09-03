import type { Metadata } from "next";
import { Card, Empty, SectionHeader } from "@/components/ui";
import { LeaderboardCard } from "@/components/benchmarks/LeaderboardCard";
import { ScoreMatrix, SourceLegend } from "@/components/benchmarks/ScoreMatrix";
import {
  getLeaderboards,
  getMatrix,
  getScores,
  getSources,
  getUnjoinedScoreCount,
  getUpdatedAt,
} from "@/lib/benchmarks";
import { formatDate, relativeTime } from "@/lib/format";
import { getCatalog } from "@/lib/models";

/**
 * The matrix joins to the model catalog, which is now fetched rather than
 * imported, so this page revalidates on the catalog's own clock. Next needs
 * this as a literal; DATA_TTL_SECONDS in src/lib/cache.ts is the same number
 * and carries the reason it is six hours and not one.
 */
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "벤치마크",
  description:
    "추적 중인 AI 모델의 리더보드와 벤치마크 비교 매트릭스입니다. 벤더 자체 발표 점수와 독립 측정 점수를 따로 구분해 표시합니다.",
};

export default async function BenchmarksPage() {
  const leaderboards = getLeaderboards();
  const matrix = await getMatrix();
  const sources = getSources();
  const updatedAt = getUpdatedAt();
  const scoreCount = (await getScores()).length;
  const unjoined = await getUnjoinedScoreCount();
  const catalog = await getCatalog();

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          벤치마크
        </h1>
        <p className="max-w-2xl text-sm text-fg-muted">
          벤치마크 수치는 금방 낡고, 벤더는 자기 시험지를 자기가 채점합니다.
          아래 모든 점수는 어디서 나온 것인지와 함께 표시하며, 값을 보간하지는
          않습니다. 어떤 모델을 특정 벤치마크로 측정한 적이 없으면 그 칸은 비어
          있습니다.
        </p>
        <p className="max-w-2xl text-sm text-fg-muted">
          점수 자체는 여전히 사람이 직접 골라 이 저장소에 커밋합니다. 그 아래에서
          바뀐 것은 조인의 <span className="text-fg">모델</span> 쪽입니다.
          카탈로그를 이제 OpenRouter에서 가져오므로, 여기 있는 모든 점수는 커밋된
          id 맵{" "}
          <span className="font-mono text-fg">data/model-id-map.json</span>을
          거쳐 자기 모델에 닿습니다. 점수{" "}
          <span className="font-mono tabular-nums text-fg">{scoreCount}</span>
          개가 연결되고
          {unjoined > 0 ? (
            <>
              {" "}
              <span className="font-mono tabular-nums text-bad">
                {unjoined}
              </span>
              개는 연결되지 않습니다 — 연결되지 않은 점수는 빈 칸으로 그리지 않고
              아예 버리므로, 조인이 깨지면 잘못된 행이 아니라 없는 행으로
              드러납니다
            </>
          ) : (
            <>, 버려지는 점수는 없습니다</>
          )}
          .
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <span className="text-fg-subtle">
            데이터 업데이트{" "}
            <span className="font-mono tabular-nums text-fg">
              {formatDate(updatedAt)}
            </span>
            {updatedAt ? (
              <span className="text-fg-subtle"> ({relativeTime(updatedAt)})</span>
            ) : null}
          </span>
          <span className="text-fg-subtle">
            모델 이름과 프로바이더 출처:{" "}
            {catalog.live ? (
              <span className="text-good">실시간 OpenRouter 카탈로그</span>
            ) : (
              <span className="text-warn">
                커밋된 id 맵 — 실시간 카탈로그를 사용할 수 없습니다
              </span>
            )}
          </span>
          {sources.length > 0 ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fg-subtle">
              <span>출처:</span>
              {sources.map((s, i) => (
                <span key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {s.name}
                  </a>
                  {i < sources.length - 1 ? (
                    <span className="text-fg-subtle">,</span>
                  ) : null}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </header>

      <section>
        <SectionHeader
          title="리더보드"
          subtitle="막대는 보드끼리가 아니라 각 보드 안에서만 정규화합니다 — 보드 간 척도는 비교할 수 없습니다."
        />
        {leaderboards.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {leaderboards.map((lb) => (
              <LeaderboardCard key={lb.id} leaderboard={lb} />
            ))}
          </div>
        ) : (
          <Empty>아직 데이터셋에 리더보드가 없습니다.</Empty>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="비교 매트릭스"
          subtitle="공개된 점수가 하나 이상 있는 모델마다 한 행씩입니다. 음영은 열마다 따로 순위를 매깁니다."
          action={<SourceLegend />}
        />
        {matrix.rows.length > 0 ? (
          <ScoreMatrix matrix={matrix} />
        ) : (
          <Empty>아직 데이터셋에 벤치마크 점수가 없습니다.</Empty>
        )}
      </section>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-fg">읽는 법</h2>
        <ul className="mt-2 space-y-1.5 text-xs text-fg-muted">
          <li>
            벤더 자체 발표 점수는 그 모델을 파는 회사의 모델 카드나 출시
            게시물에서 가져옵니다. 회사가 직접 짠 스캐폴딩으로 측정한 경우가 많아
            독립 측정 결과와 직접 비교할 수 없습니다.
          </li>
          <li>
            독립 측정 점수는 서드파티 하네스에서 나옵니다. 대체로 더 낮고, 대체로
            더 비교할 만합니다.
          </li>
          <li>
            열 머리글의 화살표는 그 벤치마크에서 &ldquo;더 좋음&rdquo;이 어느
            방향인지 가리키며, 음영도 그 방향을 따릅니다.
          </li>
          <li>
            벤치마크에는 수명 주기가 있습니다.{" "}
            <span className="text-warn">포화</span> 또는{" "}
            <span className="text-bad">은퇴</span>로 표시된 열은 연속성을 위해서만
            남겨둡니다 — 더 이상 프런티어 모델을 갈라내지 못하므로, 그 점수는 현역
            벤치마크와 나란히 놓을 수 있는 비교 신호가 아닙니다. 태그에 마우스를
            올리면 그 이유와, 후속 벤치마크가 있는 경우 그 이름을 볼 수 있습니다.
          </li>
          <li>
            SWE-bench Verified가 대표적인 경고 사례입니다. OpenAI는 오염과 결함
            있는 테스트를 이유로 2026년 2월 이 벤치마크를 프런티어 코딩 신호로
            더 이상 취급하지 않기로 했습니다. 그 결정과 함께 인용되는 구체적인
            감사 비율 수치는 2차 보도로만 떠돌기 때문에, 여기서는 사실로 옮기지
            않습니다.
          </li>
        </ul>
      </Card>
    </div>
  );
}
