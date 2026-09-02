import { unstable_cache } from "next/cache";

import { DATA_TTL_SECONDS } from "@/lib/cache";
import { fetch_arcprize } from "@/lib/fetchers/arcprize";
import { fetch_arena } from "@/lib/fetchers/arena";
import { fetch_designarena } from "@/lib/fetchers/designarena";
import { fetch_epoch } from "@/lib/fetchers/epoch";
import { fetch_openrouter } from "@/lib/fetchers/openrouter";
import { fetch_scale } from "@/lib/fetchers/scale";
import { fetch_swebench } from "@/lib/fetchers/swebench";
import { fetch_terminalbench } from "@/lib/fetchers/terminalbench";
import { fallbackResult } from "@/lib/snapshot";
import type { LeaderboardResult } from "@/lib/types";

type Fetcher = () => Promise<LeaderboardResult>;

/** sourceId (matching LEADERBOARD_SOURCES) -> its fetcher. */
const FETCHERS: Record<string, Fetcher> = {
  "openrouter-usage": fetch_openrouter,
  "arc-prize": fetch_arcprize,
  "epoch-eci": fetch_epoch,
  "design-arena": fetch_designarena,
  "terminal-bench": fetch_terminalbench,
  "swe-bench": fetch_swebench,
  arena: fetch_arena,
  "scale-swe-bench-pro": fetch_scale,
};

/**
 * Every source, fetched in parallel. One source failing must never take the
 * page down, so each is individually guarded and degrades to its snapshot.
 */
/**
 * How long one collection of all boards is served before we refetch.
 * The window itself, and why it is six hours rather than one, lives in
 * src/lib/cache.ts alongside every other consumer of it.
 */
export const LEADERBOARD_TTL_SECONDS = DATA_TTL_SECONDS;

async function fetchAllUncached(): Promise<LeaderboardResult[]> {
  const entries = Object.entries(FETCHERS);
  const settled = await Promise.allSettled(entries.map(([, fn]) => fn()));

  return settled.map((outcome, i) => {
    const sourceId = entries[i][0];
    if (outcome.status === "fulfilled") {
      // A fetcher that returned a stub/misattributed id still gets pinned to
      // the source it was registered under, so the UI can always join them.
      return { ...outcome.value, sourceId };
    }
    const reason =
      outcome.reason instanceof Error
        ? outcome.reason.message
        : "unknown error";
    return fallbackResult(sourceId, `Fetcher threw: ${reason}`);
  });
}

/**
 * One collection per cache window, shared by every visitor.
 *
 * Per-`fetch` revalidation is not enough on its own: Next's data cache does
 * not cache POST requests, so a POST-only source would go out to the network
 * on every page view — which, on a public deployment, means hammering someone
 * else's API once per visitor. Caching the whole aggregate fixes that
 * uniformly, whatever transport each source happens to use.
 *
 * `retrievedAt` inside each result is deliberately the moment of the real
 * fetch, not of the cache read, so the page reports when the numbers were
 * actually obtained rather than implying they are seconds old.
 */
const cachedFetchAll = unstable_cache(
  fetchAllUncached,
  ["all-leaderboards"],
  { revalidate: LEADERBOARD_TTL_SECONDS, tags: ["leaderboards"] },
);

export async function fetchAllLeaderboards(): Promise<LeaderboardResult[]> {
  return cachedFetchAll();
}

export async function fetchLeaderboard(
  sourceId: string,
): Promise<LeaderboardResult> {
  const fn = FETCHERS[sourceId];
  if (!fn) return fallbackResult(sourceId, "No fetcher registered.");
  try {
    return { ...(await fn()), sourceId };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return fallbackResult(sourceId, `Fetcher threw: ${reason}`);
  }
}
