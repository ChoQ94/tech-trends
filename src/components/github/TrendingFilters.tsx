import Link from "next/link";
import {
  LANGUAGES,
  TRENDING_WINDOWS,
  WINDOW_LABELS,
} from "@/lib/github";
import type { TrendingWindow } from "@/lib/types";

const PILL_BASE =
  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors";
const PILL_ACTIVE = "border-accent/50 bg-accent-dim/60 text-accent";
const PILL_IDLE =
  "border-border bg-surface-2 text-fg-muted hover:border-border-strong hover:text-fg";

function href(window: TrendingWindow, language: string | null): string {
  const params = new URLSearchParams({ window });
  if (language) params.set("lang", language);
  return `?${params}`;
}

function Pill({
  active,
  to,
  children,
}: {
  active: boolean;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={to}
      aria-current={active ? "page" : undefined}
      className={`${PILL_BASE} ${active ? PILL_ACTIVE : PILL_IDLE}`}
    >
      {children}
    </Link>
  );
}

export function TrendingFilters({
  window,
  language,
}: {
  window: TrendingWindow;
  language: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-fg-subtle">
          기간
        </span>
        {TRENDING_WINDOWS.map((w) => (
          <Pill key={w} active={w === window} to={href(w, language)}>
            {WINDOW_LABELS[w]}
          </Pill>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-fg-subtle">
          언어
        </span>
        <Pill active={language === null} to={href(window, null)}>
          전체
        </Pill>
        {LANGUAGES.map((lang) => (
          <Pill
            key={lang.value}
            active={lang.value === language}
            to={href(window, lang.value)}
          >
            {lang.label}
          </Pill>
        ))}
      </div>
    </div>
  );
}
