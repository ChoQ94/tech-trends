import type { Leaderboard, LeaderboardResult, SourceHealth } from "@/lib/types";
import raw from "../../data/leaderboards-snapshot.json";

/**
 * Last-known-good data for every source, committed to the repo.
 *
 * A live fetch that fails must not blank the page, and must not quietly
 * pass off old numbers as current — so it falls back to here and the result
 * is marked stale, carrying the date the snapshot was actually captured.
 */
export interface SnapshotEntry {
  boards: Leaderboard[];
  upstreamUpdatedAt: string | null;
  capturedAt: string;
}

const snapshot = raw as unknown as Record<string, SnapshotEntry>;

export function getSnapshot(sourceId: string): SnapshotEntry | null {
  const entry = snapshot[sourceId];
  return entry && Array.isArray(entry.boards) ? entry : null;
}

/** Build the result a source returns when its live fetch could not be used. */
export function fallbackResult(
  sourceId: string,
  error: string,
): LeaderboardResult {
  const entry = getSnapshot(sourceId);
  const health: SourceHealth = entry ? "stale" : "unavailable";
  return {
    sourceId,
    boards: entry?.boards ?? [],
    health,
    retrievedAt: entry?.capturedAt ?? new Date().toISOString(),
    upstreamUpdatedAt: entry?.upstreamUpdatedAt ?? null,
    error,
  };
}

export function liveResult(
  sourceId: string,
  boards: Leaderboard[],
  upstreamUpdatedAt: string | null,
): LeaderboardResult {
  return {
    sourceId,
    boards,
    health: "live",
    retrievedAt: new Date().toISOString(),
    upstreamUpdatedAt,
    error: null,
  };
}
