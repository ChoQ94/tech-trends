import { leaderboardEntryLabel } from "@/lib/benchmarks";
import { getModelMap } from "@/lib/models";
import type {
  Leaderboard,
  LeaderboardEntry,
  LeaderboardResult,
  Provider,
} from "@/lib/types";

/**
 * Board rows with the catalog join already done.
 *
 * BoardCard used to do this join itself: it was an async Server Component
 * that `await`ed getModelMap() per card. That made it impossible to render
 * /leaderboards anywhere but on the server, which is exactly what the
 * `?source=` filter needed to stop doing. Two ways out — ship the whole
 * model map to the browser, or resolve the names before they leave the
 * server. This is the second. It sends two extra fields per row instead of
 * 400-odd model records, and it keeps the join where the catalog is.
 *
 * The resolution rules do not change: a row that cannot be lined up with a
 * model we hold keeps the source's own wording and gets no provider and no
 * link, rather than being guessed at.
 */
export interface ResolvedEntry extends LeaderboardEntry {
  /** Display name, reconciled with the catalog where the entry resolved. */
  label: string;
  /** Provider of the model this row resolved to; null when it did not. */
  resolvedProvider: Provider | null;
}

export interface ResolvedBoard extends Omit<Leaderboard, "entries"> {
  entries: ResolvedEntry[];
}

export interface ResolvedResult extends Omit<LeaderboardResult, "boards"> {
  boards: ResolvedBoard[];
}

/** Resolve every row of every board against the catalog, in one pass. */
export async function resolveResults(
  results: LeaderboardResult[],
): Promise<ResolvedResult[]> {
  const modelMap = await getModelMap();
  return results.map((result) => ({
    ...result,
    boards: (result.boards ?? []).map((board) => ({
      ...board,
      entries: (board.entries ?? []).map((entry) => ({
        ...entry,
        label: leaderboardEntryLabel(entry, modelMap),
        resolvedProvider: entry.modelId
          ? (modelMap.get(entry.modelId)?.provider ?? null)
          : null,
      })),
    })),
  }));
}
