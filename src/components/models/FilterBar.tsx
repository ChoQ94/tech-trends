import Link from "next/link";
import { STATUS_MEANING } from "@/lib/model-query";
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
      <FilterRow label="Provider">
        <Chip
          href={buildModelsHref({
            status: activeStatus,
            openWeights: activeOpenWeights,
          })}
          active={!activeProvider}
          count={total}
        >
          All
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

      <FilterRow label="Status">
        <Chip
          href={buildModelsHref({
            provider: activeProvider,
            openWeights: activeOpenWeights,
          })}
          active={!activeStatus}
        >
          All
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
            {s}
          </Chip>
        ))}
      </FilterRow>

      <FilterRow label="Weights">
        <Chip
          href={buildModelsHref({
            provider: activeProvider,
            status: activeStatus,
          })}
          active={!activeOpenWeights}
          count={total}
        >
          Any
        </Chip>
        <Chip
          href={buildModelsHref({
            provider: activeProvider,
            status: activeStatus,
            openWeights: true,
          })}
          active={activeOpenWeights}
          count={openWeightsCount}
          title="Inferred from the presence of a HuggingFace id on the OpenRouter listing — a signal, not a licence check."
        >
          open
        </Chip>
      </FilterRow>

      {unclassified > 0 ? (
        <p className="text-[11px] leading-4 text-fg-subtle sm:pl-[4.75rem]">
          <span className="font-mono tabular-nums text-fg-muted">
            {unclassified}
          </span>{" "}
          of{" "}
          <span className="font-mono tabular-nums text-fg-muted">{total}</span>{" "}
          models are <span className="text-fg-muted">unclassified</span>:
          OpenRouter publishes no lifecycle field, so nothing here claims a
          model is a flagship, current or superseded. The only status derivable
          from the feed is <span className="text-bad">deprecated</span>, set
          when OpenRouter publishes a real retirement date.
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
