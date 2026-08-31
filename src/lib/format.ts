/**
 * Small, dependency-free formatters shared across every page.
 * All of these tolerate null/undefined and return DASH so the UI never
 * prints "null" or invents a value it does not have.
 */

export const DASH = "—";

/** 12400 -> "12.4k", 3_400_000 -> "3.4M" */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const value = abs / size;
      const digits = value >= 100 ? 0 : value >= 10 ? 1 : 1;
      return `${sign}${trimZero(value.toFixed(digits))}${suffix}`;
    }
  }
  return `${sign}${trimZero(abs.toFixed(abs % 1 === 0 ? 0 : 1))}`;
}

/**
 * Token counts read better on binary-ish boundaries:
 * 1_000_000 -> "1M", 200_000 -> "200K", 1_048_576 -> "1M", 8192 -> "8K".
 */
export function formatTokens(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n < 0) {
    return DASH;
  }
  if (n >= 1e6) return `${trimZero((n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1))}M`;
  if (n >= 1000) return `${trimZero((n / 1000).toFixed(n % 1000 === 0 ? 0 : 1))}K`;
  return String(n);
}

/** 3 -> "$3.00", 0.27 -> "$0.27", 1.25 -> "$1.25", null -> "—" */
export function formatUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  if (n === 0) return "$0";
  const digits = Math.abs(n) < 1 ? 2 : 2;
  return `$${n.toFixed(digits)}`;
}

/** "2025-09-29" -> "Sep 29, 2025" */
export function formatDate(input: string | null | undefined): string {
  const d = toDate(input);
  if (!d) return DASH;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** "2025-09-29" -> "11 months ago" (relative to `now`, default: today) */
export function relativeTime(
  input: string | null | undefined,
  now: Date = new Date(),
): string {
  const d = toDate(input);
  if (!d) return DASH;
  const seconds = Math.round((d.getTime() - now.getTime()) / 1000);
  const fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [86400 * 7, "day"],
    [86400 * 30, "week"],
    [86400 * 365, "month"],
    [Infinity, "year"],
  ];
  const divisors: Record<string, number> = {
    second: 1,
    minute: 60,
    hour: 3600,
    day: 86400,
    week: 86400 * 7,
    month: 86400 * 30,
    year: 86400 * 365,
  };
  const abs = Math.abs(seconds);
  for (const [limit, unit] of steps) {
    if (abs < limit) {
      return fmt.format(Math.round(seconds / divisors[unit]), unit);
    }
  }
  return fmt.format(Math.round(seconds / divisors.year), "year");
}

/** Year-only helper used in dense table cells. */
export function formatYear(input: string | null | undefined): string {
  const d = toDate(input);
  return d ? String(d.getUTCFullYear()) : DASH;
}

function toDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function trimZero(s: string): string {
  return s.replace(/\.0$/, "");
}
