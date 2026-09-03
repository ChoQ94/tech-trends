import Link from "next/link";
import { Empty, SectionHeader } from "@/components/ui";
import { Families } from "@/components/models/Families";
import {
  FilterBar,
  buildModelsHref,
  parseFacet,
} from "@/components/models/FilterBar";
import { ModelTable } from "@/components/models/ModelTable";
import {
  PAGE_SIZE,
  Pagination,
  pageCount,
  parsePage,
} from "@/components/models/Pagination";
import {
  getFamilies,
  listProviders,
  listStatusFilters,
  selectModels,
} from "@/lib/model-query";
import type { Model, ModelStatus } from "@/lib/types";

/**
 * Everything on /models below the header: the filter chips, the count, the
 * table and the families grid.
 *
 * This is rendered twice from two different places, and that is the point.
 * The page renders it on the server with no filter applied, as the Suspense
 * fallback, so the prerendered HTML is the real first page of the catalog
 * rather than a skeleton; ModelsBrowser renders it again in the browser with
 * whatever the query string asks for. Both go through the same function, so
 * "what the server prerenders" and "what the client shows" cannot drift
 * apart.
 *
 * It takes only the model list. Provider order, status order and every count
 * beside a chip are derived here rather than passed in, because deriving them
 * twice is free and shipping them twice is not.
 */
export function ModelsSection({
  models,
  activeProviders,
  activeStatuses,
  page,
}: {
  /** The full, unfiltered catalog in its canonical sort order. */
  models: Model[];
  /** Already resolved against the catalog; see resolveModelFilters. */
  activeProviders: string[];
  activeStatuses: ModelStatus[];
  /** 1-based and ≥ 1, but not yet checked against this filter's row count. */
  page: number;
}) {
  const providers = listProviders(models);
  const statuses = listStatusFilters(models);
  const filtered = activeProviders.length > 0 || activeStatuses.length > 0;

  const rows = selectModels(models, {
    providers: activeProviders,
    statuses: activeStatuses,
  });

  // A `?page` past the end of this filter's results is clamped rather than
  // shown as an empty table — the same fall-through the filters use. Filter
  // links never carry `page`, so narrowing the results always lands on 1
  // anyway; this catches a hand-edited or stale deep link.
  const pages = pageCount(rows.length);
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const providerCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  for (const m of models) {
    providerCounts.set(
      String(m.provider),
      (providerCounts.get(String(m.provider)) ?? 0) + 1,
    );
    statusCounts.set(m.status, (statusCounts.get(m.status) ?? 0) + 1);
  }

  // Families are grouped from everything the filters left, not from the ten
  // rows currently on screen: the section describes the selection, and a grid
  // that reshuffled on every page step would be describing the pagination.
  const families = getFamilies(rows).filter((f) => f.models.length > 1);

  return (
    <>
      <section className="space-y-4">
        <FilterBar
          providers={providers}
          statuses={statuses}
          activeProviders={activeProviders}
          activeStatuses={activeStatuses}
          providerCounts={providerCounts}
          statusCounts={statusCounts}
          total={models.length}
        />

        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs text-fg-subtle">
            모델{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {models.length}
            </span>
            개 중{" "}
            <span className="font-mono tabular-nums text-fg-muted">
              {rows.length}
            </span>
            개 일치
          </p>
          {filtered ? (
            <Link
              href={buildModelsHref({})}
              scroll={false}
              className="text-xs text-accent hover:underline"
            >
              필터 해제
            </Link>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <>
            <ModelTable models={visible} />
            <Pagination
              page={current}
              pages={pages}
              total={rows.length}
              activeProviders={activeProviders}
              activeStatuses={activeStatuses}
            />
          </>
        ) : (
          <Empty>
            이 필터에 해당하는 모델이 없습니다. 프로바이더나 상태 칩을 해제해
            보십시오.
          </Empty>
        )}
      </section>

      {families.length > 0 ? (
        <section>
          <SectionHeader
            title="패밀리"
            subtitle="이름 앞부분이 같은 id를 묶었습니다. 모델과 그 변형이 서로 무관한 행처럼 보이지 않게 하기 위한 것입니다. 계승 관계를 뜻하지는 않습니다 — 출처가 그런 정보를 제공하지 않습니다."
          />
          <Families families={families} limit={12} />
          {families.length > 12 ? (
            <p className="mt-3 text-xs text-fg-subtle">
              이 화면의 패밀리{" "}
              <span className="font-mono tabular-nums text-fg-muted">
                {families.length}
              </span>
              개 중 규모가 큰 12개만 표시합니다. 나머지는 프로바이더로 필터하면 볼 수
              있습니다.
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

/**
 * Turn raw query-string values into the filter the page actually applies.
 *
 * A provider or status the catalog does not offer is not a filter — it is
 * dropped, so `?provider=Bogus` shows everything and, just as importantly, no
 * chip lights up claiming a filter that is not applied. Dropping is per
 * value, so `?provider=Bogus,Anthropic` is the Anthropic filter and nothing
 * else.
 *
 * The lists resolved against are the ones the chips offer, which is stricter
 * than "is a known value": `?status=legacy` falls through while OpenRouter is
 * publishing no legacy rows, and `?status=unclassified` falls through because
 * that facet no longer offers a chip for it (see listStatusFilters).
 */
export function resolveModelFilters(
  raw: {
    provider: string | null;
    status: string | null;
    page: string | null;
  },
  models: Model[],
): {
  activeProviders: string[];
  activeStatuses: ModelStatus[];
  page: number;
} {
  const providers = new Set(listProviders(models).map(String));
  const statuses = new Set<string>(listStatusFilters(models));
  return {
    activeProviders: parseFacet(raw.provider).filter((p) => providers.has(p)),
    activeStatuses: parseFacet(raw.status).filter((s): s is ModelStatus =>
      statuses.has(s),
    ),
    page: parsePage(raw.page),
  };
}
