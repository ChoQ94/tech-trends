import Link from "next/link";
import { Badge, Card, Empty, SectionHeader, Stat } from "@/components/ui";
import { LeaderboardCard } from "@/components/benchmarks/LeaderboardCard";
import { ModelCard } from "@/components/models/ModelCard";
import { ProviderLabel } from "@/components/models/ProviderLabel";
import {
  getBenchmarkCount,
  getPrimaryLeaderboard,
  getScores,
  getUpdatedAt,
} from "@/lib/benchmarks";
import { formatDate, relativeTime } from "@/lib/format";
import { CATALOG_ENDPOINT } from "@/lib/model-catalog";
import {
  getAllModels,
  getCatalog,
  getLatestReleases,
  getProviders,
  getRetiring,
} from "@/lib/models";

/**
 * The catalog is fetched; see src/lib/model-catalog.ts for the cache window.
 * Next needs this as a literal, so it restates DATA_TTL_SECONDS from
 * src/lib/cache.ts rather than importing it.
 */
export const revalidate = 21600;

export default async function OverviewPage() {
  const catalog = await getCatalog();
  const models = await getAllModels();
  const providers = await getProviders();
  const latest = await getLatestReleases(6);
  const retiring = await getRetiring();
  const primary = getPrimaryLeaderboard();
  const updatedAt = getUpdatedAt();
  const scoreCount = (await getScores()).length;

  return (
    <div className="space-y-12">
      {/* The visible hero was dropped so the numbers lead. Every other route
          still carries an h1, so this stays for screen readers and crawlers
          rather than leaving the landing page headingless. */}
      <h1 className="sr-only">지금 나와 있는 것들</h1>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="추적 중인 모델"
          value={models.length}
          hint={`${models.filter((m) => m.openWeights).length}개는 가중치가 공개된 것으로 보입니다`}
        />
        <Stat label="프로바이더" value={providers.length} hint="서로 다른 벤더 수" />
        <Stat
          label="벤치마크"
          value={getBenchmarkCount()}
          hint={`공개된 점수 ${scoreCount}건`}
        />
        <Stat
          label="카탈로그 수집"
          value={
            <span className="text-lg">
              {catalog.live ? formatDate(catalog.retrievedAt) : "—"}
            </span>
          }
          hint={
            catalog.live
              ? relativeTime(catalog.retrievedAt)
              : "실시간 수집 실패 — 식별 정보만 표시합니다"
          }
        />
      </section>

      <section>
        <SectionHeader
          title="최근 등재된 모델"
          subtitle="OpenRouter 카탈로그에 가장 최근 추가된 모델입니다. 벤더가 발표한 날짜가 아니라 등재된 날짜 기준입니다."
          action={
            <Link href="/models" className="text-xs text-accent hover:underline">
              전체 카탈로그 →
            </Link>
          }
        />
        {latest.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((m) => (
              <ModelCard key={m.id} model={m} />
            ))}
          </div>
        ) : (
          <Empty>
            날짜가 있는 등재 항목이 없습니다. 실시간 카탈로그를 가져오지 못했습니다.
          </Empty>
        )}
      </section>

      {/*
        There was a "Current flagships" section here, one model per provider.
        It cannot be rebuilt: flagship was a judgement typed into the old
        curated file, and OpenRouter publishes no lifecycle at all. Picking
        "newest per provider" instead would look like the same section and be
        an invention, so what stands here now is what the feed actually
        supports — where the numbers come from, and the one lifecycle fact it
        does publish.
      */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col">
          <SectionHeader
            title="이 카탈로그를 읽는 법"
            subtitle="모든 수치에는 출처가 있고, 그 출처는 벤더가 아닙니다."
          />
          <Card className="flex flex-1 flex-col gap-3 p-5 text-sm leading-6 text-fg-muted">
            <p>
              카탈로그의 출처는{" "}
              <a
                href={CATALOG_ENDPOINT}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-accent hover:underline"
              >
                openrouter.ai/api/v1/models
              </a>
              입니다. 6시간에 한 번 가져와 모든 방문자가 함께 씁니다.
            </p>
            <ul className="space-y-1.5 text-xs leading-5">
              <li>
                날짜는 <span className="text-fg">OpenRouter가 등재한</span> 시점이지,
                벤더가 발표한 시점이 아닙니다.
              </li>
              <li>
                가격은 <span className="text-fg">OpenRouter의 가격</span>이지,
                벤더의 정가가 아닙니다.
              </li>
              <li>
                가중치 공개 여부는 등재 정보에 HuggingFace id가 있는지로{" "}
                <span className="text-fg">추정</span>한 것이지, 라이선스를 확인한
                결과가 아닙니다.
              </li>
              <li>
                <span className="text-fg">수명주기 필드가 없어서</span> 어떤 모델도
                대표 모델로 부르지 않습니다. 순위도 매기지 않습니다.
              </li>
              <li>
                <span className="font-mono tabular-nums text-fg">
                  {catalog.counts.supplement}
                </span>{" "}
                개는 OpenRouter가 다루지 않는 모델이라 사람이 직접 입력했고{" "}
                <Badge tone="warn">수동</Badge>으로 표시했습니다. 접근이 제한된
                Google의 Deep Think도 여기 포함됩니다.
              </li>
            </ul>
            <Link
              href="/sources"
              className="mt-auto inline-flex w-fit items-center rounded-md border border-border-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-accent hover:text-accent"
            >
              전체 출처 보기 →
            </Link>
          </Card>
        </div>

        <div className="flex flex-col">
          <SectionHeader
            title="종료 예정"
            subtitle="피드가 공개하는 유일한 수명주기 정보인 실제 종료일입니다."
          />
          <Card className="flex flex-1 flex-col gap-3 p-5">
            {retiring.length > 0 ? (
              <>
                <ul className="space-y-2">
                  {retiring.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-baseline justify-between gap-2 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-fg">{m.name}</span>
                        <ProviderLabel
                          provider={m.provider}
                          className="hidden shrink-0 text-[11px] text-fg-subtle sm:inline-flex"
                        />
                      </span>
                      <span className="shrink-0 font-mono tabular-nums text-bad">
                        {m.retiresOn}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-auto text-[11px] leading-4 text-fg-subtle">
                  자리표시용 날짜는 표시하지 않고 버립니다. 몇몇 z-ai 항목은
                  &ldquo;만료 없음&rdquo;을 뜻하는{" "}
                  <span className="font-mono">2098-12-31</span>을 달고 있는데,
                  이를 종료일로 그리면 없는 사실을 지어내는 셈입니다.
                </p>
              </>
            ) : (
              <Empty>
                현재 카탈로그에 종료일이 기재된 모델이 없습니다.
              </Empty>
            )}
          </Card>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col">
          <SectionHeader
            title="리더보드"
            subtitle="대표 보드 상위 5개입니다."
            action={
              <Link
                href="/benchmarks"
                className="text-xs text-accent hover:underline"
              >
                전체 벤치마크 →
              </Link>
            }
          />
          {primary ? (
            <LeaderboardCard leaderboard={primary} limit={5} />
          ) : (
            <Empty>아직 리더보드 데이터가 없습니다.</Empty>
          )}
        </div>

        <div className="flex flex-col">
          <SectionHeader
            title="오픈소스"
            subtitle="개발자들이 실제로 스타를 주고 있는 것들입니다."
          />
          <Card className="flex flex-1 flex-col justify-between gap-4 p-5">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-fg">GitHub 트렌딩</h3>
              <p className="text-sm leading-6 text-fg-muted">
                지금 가장 빠르게 오르고 있는 저장소입니다. GitHub 검색 API에서
                실시간으로 가져오며 언어와 기간으로 걸러 볼 수 있습니다. 모델
                카탈로그와 마찬가지로 직접 입력한 것이 아니라 가져온 데이터입니다.
                반면 벤치마크 점수는 여전히 사람이 정리한 것이고, 기준 시점은{" "}
                {updatedAt ? formatDate(updatedAt) : "알 수 없음"}입니다.
              </p>
            </div>
            <Link
              href="/github"
              className="inline-flex w-fit items-center rounded-md border border-border-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-accent hover:text-accent"
            >
              트렌딩 저장소 보기 →
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
}
