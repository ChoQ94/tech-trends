import Link from "next/link";
import { STATUS_LABEL, STATUS_MEANING } from "@/lib/model-query";
import type { ModelStatus, Provider } from "@/lib/types";

export function buildModelsHref(next: {
  provider?: string | null;
  status?: string | null;
  openWeights?: boolean;
}): string {
  const params = new URLSearchParams();
  if (next.provider) params.set("provider", next.provider);
  if (next.status) params.set("status", next.status);
  if (next.openWeights) params.set("weights", "open");
  const qs = params.toString();
  return qs ? `/models?${qs}` : "/models";
}

function Chip({
  href,
  active,
  children,
  count,
  title,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  count?: number;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      aria-current={active ? "true" : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
        active
          ? "border-accent/50 bg-accent-dim/60 font-medium text-accent"
          : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
      }`}
    >
      <span>{children}</span>
      {count !== undefined ? (
        <span className="font-mono tabular-nums text-fg-subtle">{count}</span>
      ) : null}
    </Link>
  );
}

/**
 * Filters are plain links, so every filtered view is a shareable,
 * deep-linkable, middle-clickable URL rather than hidden component state.
 *
 * They used to be links so the page could stay a Server Component. That is
 * no longer the reason — the query is read in the browser now (see
 * ModelsBrowser) and the route is prerendered — but the links themselves are
 * the part that was worth keeping, so they stayed exactly as they were.
 */
export function FilterBar({
  providers,
  statuses,
  activeProvider,
  activeStatus,
  activeOpenWeights,
  providerCounts,
  statusCounts,
  openWeightsCount,
  total,
}: {
  providers: Provider[];
  statuses: ModelStatus[];
  activeProvider: string | null;
  activeStatus: string | null;
  activeOpenWeights: boolean;
  providerCounts: Map<string, number>;
  statusCounts: Map<string, number>;
  openWeightsCount: number;
  total: number;
}) {
  // With OpenRouter as the source there is no lifecycle field, so this filter
  // now sorts almost every model into one bucket. Saying so beside the chips
  // is better than leaving a control that looks broken.
  const unclassified = statusCounts.get("unclassified") ?? 0;
  return (
    <div className="flex flex-col gap-3">
      <FilterRow label="프로바이더">
        <Chip
          href={buildModelsHref({
            status: activeStatus,
            openWeights: activeOpenWeights,
          })}
          active={!activeProvider}
          count={total}
        >
          전체
        </Chip>
        {providers.map((p) => (
          <Chip
            key={String(p)}
            href={buildModelsHref({
              provider: String(p),
              status: activeStatus,
              openWeights: activeOpenWeights,
            })}
            active={activeProvider === p}
            count={providerCounts.get(String(p))}
          >
            {p}
          </Chip>
        ))}
      </FilterRow>

      <FilterRow label="상태">
        <Chip
          href={buildModelsHref({
            provider: activeProvider,
            openWeights: activeOpenWeights,
          })}
          active={!activeStatus}
        >
          전체
        </Chip>
        {statuses.map((s) => (
          <Chip
            key={s}
            href={buildModelsHref({
              provider: activeProvider,
              status: s,
              openWeights: activeOpenWeights,
            })}
            active={activeStatus === s}
            count={statusCounts.get(s)}
            title={STATUS_MEANING[s]}
          >
            {STATUS_LABEL[s]}
          </Chip>
        ))}
      </FilterRow>

      <FilterRow label="가중치">
        <Chip
          href={buildModelsHref({
            provider: activeProvider,
            status: activeStatus,
          })}
          active={!activeOpenWeights}
          count={total}
        >
          전체
        </Chip>
        <Chip
          href={buildModelsHref({
            provider: activeProvider,
            status: activeStatus,
            openWeights: true,
          })}
          active={activeOpenWeights}
          count={openWeightsCount}
          title="OpenRouter 등재 정보에 HuggingFace id가 있는지로 추정합니다 — 라이선스를 확인한 것이 아니라 하나의 신호일 뿐입니다."
        >
          공개
        </Chip>
      </FilterRow>

      {unclassified > 0 ? (
        <p className="text-[11px] leading-4 text-fg-subtle sm:pl-[4.75rem]">
          모델{" "}
          <span className="font-mono tabular-nums text-fg-muted">{total}</span>
          개 중{" "}
          <span className="font-mono tabular-nums text-fg-muted">
            {unclassified}
          </span>
          개가 <span className="text-fg-muted">미분류</span>입니다. OpenRouter가
          수명주기 필드를 제공하지 않아서, 여기서는 어떤 모델도 대표라거나,
          현행이라거나, 대체되었다고 주장하지 않습니다. 피드에서 도출할 수 있는
          유일한 상태는 <span className="text-bad">지원 종료</span>이며,
          OpenRouter가 실제 종료 날짜를 게시할 때만 붙습니다.
        </p>
      ) : null}
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-fg-subtle">
        {label}
      </span>
      <div className="scroll-thin -mx-1 flex flex-wrap items-center gap-1.5 px-1">
        {children}
      </div>
    </div>
  );
}
