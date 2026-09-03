import Link from "next/link";
import { STATUS_LABEL, STATUS_MEANING } from "@/lib/model-query";
import type { ModelStatus, Provider } from "@/lib/types";

/**
 * The shape of /models' query string.
 *
 * Each facet is a list, comma-separated in the URL:
 * `?provider=Anthropic,OpenAI&status=deprecated`. A comma is a legal
 * sub-delimiter in a query string and no provider name contains one, so the
 * separator stays literal — only the values themselves are percent-encoded —
 * and the URL stays readable enough to share and to edit by hand.
 */
export interface ModelsQuery {
  providers?: readonly string[];
  statuses?: readonly string[];
  /** 1-based. Omitted from the URL when it is 1, so page one has a clean URL. */
  page?: number;
}

export function buildModelsHref(next: ModelsQuery): string {
  const parts: string[] = [];
  const facet = (key: string, values: readonly string[] | undefined) => {
    if (values && values.length > 0) {
      parts.push(`${key}=${values.map(encodeURIComponent).join(",")}`);
    }
  };
  facet("provider", next.providers);
  facet("status", next.statuses);
  if (next.page && next.page > 1) parts.push(`page=${next.page}`);
  return parts.length > 0 ? `/models?${parts.join("&")}` : "/models";
}

/** Read one facet back out of the query string. */
export function parseFacet(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/**
 * Add a value to a facet, or take it out if it is already there — which is
 * what makes clicking an active chip deselect it rather than re-apply it.
 */
function toggled(values: readonly string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
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
      // Chips are a filter, not a destination: the table they change is
      // already on screen, so jumping to the top of the document on every
      // click would be pure loss.
      scroll={false}
      title={title}
      aria-pressed={active}
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
 *
 * Several values may be on at once. Within a row they are OR'd, across rows
 * AND'd, and every chip href is "the current selection with this one value
 * flipped" — so the anchor a middle-click opens is the same state the click
 * would have produced. No chip ever carries `page`: changing what is being
 * filtered always returns to the first page of the new result.
 */
export function FilterBar({
  providers,
  statuses,
  activeProviders,
  activeStatuses,
  providerCounts,
  statusCounts,
  total,
}: {
  providers: Provider[];
  /** Only the statuses that get a chip; see listStatusFilters. */
  statuses: ModelStatus[];
  activeProviders: readonly string[];
  activeStatuses: readonly ModelStatus[];
  providerCounts: Map<string, number>;
  statusCounts: Map<string, number>;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <FilterRow label="프로바이더">
        <Chip
          href={buildModelsHref({ statuses: activeStatuses })}
          active={activeProviders.length === 0}
          count={total}
        >
          전체
        </Chip>
        {providers.map((p) => (
          <Chip
            key={String(p)}
            href={buildModelsHref({
              providers: toggled(activeProviders, String(p)),
              statuses: activeStatuses,
            })}
            active={activeProviders.includes(String(p))}
            count={providerCounts.get(String(p))}
          >
            {p}
          </Chip>
        ))}
      </FilterRow>

      {statuses.length > 0 ? (
        <FilterRow label="상태">
          <Chip
            href={buildModelsHref({ providers: activeProviders })}
            active={activeStatuses.length === 0}
          >
            전체
          </Chip>
          {statuses.map((s) => (
            <Chip
              key={s}
              href={buildModelsHref({
                providers: activeProviders,
                statuses: toggled(activeStatuses, s),
              })}
              active={activeStatuses.includes(s)}
              count={statusCounts.get(s)}
              title={STATUS_MEANING[s]}
            >
              {STATUS_LABEL[s]}
            </Chip>
          ))}
        </FilterRow>
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
