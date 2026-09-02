"use client";

import { useSearchParams } from "next/navigation";
import {
  LeaderboardsSection,
  resolveSourceFilter,
  type LeaderboardRow,
} from "@/components/leaderboards/LeaderboardsSection";

/**
 * The `?source=` filter, moved into the browser.
 *
 * The page used to `await searchParams` to decide which of eight groups to
 * print, which made the whole route render once per visitor even though the
 * eight results are identical for everybody and come out of a six-hour
 * cache. Choosing between them is now a client-side array filter over the
 * prerendered results, and the route is static.
 *
 * The chips stay real `<Link>` anchors, so `?source=arena` is still a
 * shareable, deep-linkable URL; `useSearchParams` is what re-renders this
 * when one is followed without a round trip.
 */
export function LeaderboardsBrowser({ rows }: { rows: LeaderboardRow[] }) {
  const activeSource = resolveSourceFilter(
    useSearchParams().get("source"),
    rows,
  );
  return <LeaderboardsSection rows={rows} activeSource={activeSource} />;
}
