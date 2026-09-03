import Link from "next/link";
import { buildModelsHref } from "@/components/models/FilterBar";

/**
 * Rows per page.
 *
 * The catalog is several hundred rows and every one of them is dense — nine
 * figures, most of which are a dash. Ten at a time is what a reader can
 * actually hold; the rest is a scroll bar pretending to be a table.
 */
export const PAGE_SIZE = 10;

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/**
 * `?page` as an integer, before it is checked against a result set.
 *
 * Anything that is not a whole number ≥ 1 is page one, on the same
 * fall-through principle as the filters: a query param nobody can act on is
 * ignored, never an error page and never an empty table. Clamping to the last
 * page that exists needs the filtered row count, so it happens in
 * ModelsSection where that count is known.
 */
export function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function Step({
  href,
  children,
  disabled,
  label,
}: {
  href: string;
  children: React.ReactNode;
  disabled: boolean;
  label: string;
}) {
  const shape =
    "inline-flex items-center rounded-md border px-2.5 py-1 text-xs transition-colors";
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${shape} border-border bg-surface text-fg-subtle opacity-50`}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      // Same reason as the filter chips: the table is already on screen, so
      // paging it must not throw the reader back to the top of the document.
      scroll={false}
      aria-label={label}
      className={`${shape} border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg`}
    >
      {children}
    </Link>
  );
}

/**
 * Where you are, out of how much, and the two steps either side of it.
 *
 * Stacks on narrow screens so the whole control fits at 375px without a
 * horizontal scroll. The hrefs are built from the active filters, so a page
 * link carries the filter with it and stays shareable.
 */
export function Pagination({
  page,
  pages,
  total,
  activeProviders,
  activeStatuses,
}: {
  /** 1-based, already clamped into range. */
  page: number;
  pages: number;
  /** Rows matching the filter, across all pages. */
  total: number;
  activeProviders: readonly string[];
  activeStatuses: readonly string[];
}) {
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const hrefFor = (n: number) =>
    buildModelsHref({
      providers: activeProviders,
      statuses: activeStatuses,
      page: n,
    });

  return (
    <nav
      aria-label="모델 표 페이지"
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs text-fg-subtle">
        전체{" "}
        <span className="font-mono tabular-nums text-fg-muted">{total}</span>개
        중{" "}
        <span className="font-mono tabular-nums text-fg-muted">
          {first}–{last}
        </span>
        번째
      </p>
      <div className="flex items-center gap-2">
        <Step
          href={hrefFor(page - 1)}
          disabled={page <= 1}
          label="이전 페이지"
        >
          이전
        </Step>
        <span className="text-xs text-fg-subtle" aria-live="polite">
          <span className="font-mono tabular-nums text-fg-muted">{page}</span>
          {" / "}
          <span className="font-mono tabular-nums text-fg-muted">{pages}</span>
          {" 페이지"}
        </span>
        <Step
          href={hrefFor(page + 1)}
          disabled={page >= pages}
          label="다음 페이지"
        >
          다음
        </Step>
      </div>
    </nav>
  );
}
