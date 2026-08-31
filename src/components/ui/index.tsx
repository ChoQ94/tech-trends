import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  /** Set when the card is an anchor target, e.g. /sources#arena. */
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`rounded-xl border border-border bg-surface ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-fg">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * `accent` is the only filled tone and the only bold one — it marks the
 * primary thing, and that weight is what separates a flagship badge from
 * every other badge with colour imagined away. The word inside each badge is
 * still the signal; these are reinforcement.
 *
 * `cyan` replaces the retired `purple` tone. Purple sat 7° from the lilac
 * accent and carried `preview` in the same status column where `flagship`
 * is the accent — two near-identical violets for two different meanings.
 * Cyan is 90° from the accent and 27° from `good` (`current`), and the two
 * never share a component with cyan's other use, the independently-measured
 * dot on /benchmarks.
 */
const TONES = {
  neutral: "border-border-strong bg-surface-2 text-fg-muted",
  accent: "border-accent/50 bg-accent-dim/70 font-semibold text-accent",
  good: "border-good/30 bg-good/10 text-good",
  warn: "border-warn/30 bg-warn/10 text-warn",
  bad: "border-bad/40 bg-bad/10 text-bad",
  cyan: "border-cyan/30 bg-cyan/10 text-cyan",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-fg-subtle">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-fg">
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-fg-muted">{hint}</div> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-fg-muted">
      {children}
    </div>
  );
}

const CALLOUT_TONES = {
  neutral: "border-border-strong bg-surface-2 text-fg-muted",
  accent: "border-accent/40 bg-accent-dim/35 text-fg-muted",
  warn: "border-warn/40 bg-warn/5 text-fg-muted",
  bad: "border-bad/40 bg-bad/5 text-fg-muted",
} as const;

export type CalloutTone = keyof typeof CALLOUT_TONES;

const CALLOUT_LABEL_TONES: Record<CalloutTone, string> = {
  neutral: "text-fg",
  accent: "text-accent",
  warn: "text-warn",
  bad: "text-bad",
};

/**
 * A labelled disclosure that has to be read next to the number it qualifies —
 * a conflict of interest, a fetch that failed — rather than hidden behind a
 * link that nobody follows.
 */
export function Callout({
  label,
  tone = "neutral",
  children,
}: {
  label: string;
  tone?: CalloutTone;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs leading-5 ${CALLOUT_TONES[tone]}`}
    >
      <span
        className={`mr-1.5 text-[10px] font-semibold uppercase tracking-wide ${CALLOUT_LABEL_TONES[tone]}`}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
