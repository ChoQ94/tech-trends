import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "@/components/ui";
import { ModelsBrowser } from "@/components/models/ModelsBrowser";
import { ModelsSection } from "@/components/models/ModelsSection";
import { formatDate, relativeTime } from "@/lib/format";
import { CATALOG_ENDPOINT } from "@/lib/model-catalog";
import { getAllModels, getCatalog, getProviders } from "@/lib/models";

/**
 * Matches the catalog's own cache window; see src/lib/model-catalog.ts. Next
 * needs this as a literal, so it restates DATA_TTL_SECONDS from
 * src/lib/cache.ts rather than importing it.
 */
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "모델",
  description:
    "OpenRouter가 등재한 모든 모델을 실시간으로 가져옵니다. 프로바이더, 등재일, 컨텍스트 윈도우, 최대 출력, 그리고 OpenRouter의 100만 토큰당 가격을 담았습니다.",
};

export default async function ModelsPage() {
  const catalog = await getCatalog();
  const all = await getAllModels();
  const providers = await getProviders();
  const { counts } = catalog;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          모델 카탈로그
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-fg-muted">
          프로바이더 {providers.length}곳의 모델 {all.length}개를{" "}
          <a
            href={CATALOG_ENDPOINT}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-accent hover:underline"
          >
            openrouter.ai/api/v1/models
          </a>
          에서 가져와 6시간 동안 캐시합니다. 대시는 수치가 공개되지 않았다는
          뜻이지, 추측한 값이 아닙니다.
        </p>

        {catalog.live ? (
          <p className="text-xs leading-5 text-fg-subtle">
            가져온 시각{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {formatDate(catalog.retrievedAt)}
            </span>{" "}
            ({relativeTime(catalog.retrievedAt)}) · 응답{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {counts.listed}
            </span>
            행 중 <span className="font-mono">:free</span>/
            <span className="font-mono">:batch</span>{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {counts.variantsFolded}
            </span>
            건은 가격의 기준이 되는 모델에 합쳤고,{" "}
            <span className="font-mono">~vendor/*-latest</span>{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {counts.aliasPointers}
            </span>
            건은 뺐으며, OpenRouter가 다루지 않는{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {counts.supplement}
            </span>
            개는 손으로 추가해 <span className="text-warn">수동</span>으로
            표시했습니다. 그래서 아래 행 수는 응답 행 수와 다릅니다 · 등재일,
            가격, 수명주기를 각각 어디까지 믿을 수 있는지는{" "}
            <Link href="/sources" className="text-accent hover:underline">
              /sources
            </Link>
            에 정리해 두었습니다.
          </p>
        ) : (
          <Callout label="실시간 카탈로그를 가져오지 못했습니다" tone="bad">
            {catalog.error} 아래에 보이는 것은 카탈로그가 아닙니다.{" "}
            <span className="font-mono">data/model-id-map.json</span>의 식별
            테이블에 손으로 기록한 모델 {counts.supplement}개를 더한 것으로,{" "}
            <Link href="/benchmarks" className="text-accent hover:underline">
              /benchmarks
            </Link>
            가 점수를 그대로 연결할 수 있게 하기 위한 것입니다. 이 페이지의 사양과
            가격이 모두 비어 있는 이유는 우리가 그 값을 갖고 있지 않기 때문이지,
            모델에 그 값이 없기 때문이 아닙니다.
          </Callout>
        )}
      </header>

      {/*
        The fallback is the real default view — unfiltered, page one —
        rendered on the server.

        `useSearchParams` cannot run during a prerender, so React renders this
        fallback into the static HTML and swaps in the browser's answer at
        hydration. Making the fallback the real default view rather than a
        skeleton means the common case — arriving at /models with no query
        string — paints the finished page from the CDN and then replaces it
        with something byte-identical: no skeleton, no reflow, nothing to
        watch. A shared link that does carry a filter or a page number shows
        the default view for the moment before hydration, which is the one
        case we cannot prerender our way out of without asking the server to
        render per visitor again — which is the cost we came here to remove.
      */}
      <Suspense
        fallback={
          <ModelsSection
            models={all}
            activeProviders={[]}
            activeStatuses={[]}
            page={1}
          />
        }
      >
        <ModelsBrowser models={all} />
      </Suspense>
    </div>
  );
}
