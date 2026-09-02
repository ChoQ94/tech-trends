import { unstable_cache } from "next/cache";

import { DATA_TTL_SECONDS } from "@/lib/cache";
import {
  buildSlugIndex,
  lookupSlug,
  normalizeSlug,
  type SlugIndex,
} from "@/lib/model-match";
import { fallbackResult, liveResult } from "@/lib/snapshot";
import type { Leaderboard, LeaderboardEntry, LeaderboardResult } from "@/lib/types";

const SOURCE_ID = "design-arena";
const ENDPOINT = "https://www.designarena.ai/api/leaderboard";
const REGISTRY_ENDPOINT = "https://www.designarena.ai/api/registry";
const PAGE_URL = "https://www.designarena.ai/";
const USER_AGENT =
  "tech-trends-dashboard/1.0 (leaderboard aggregator; +https://www.designarena.ai/)";

const MAX_ENTRIES = 50;

/**
 * The POST body is `{ arenaType, category }`, both required, both lowercase
 * slugs — the API rejects the site's display labels ("Website", "Game Dev").
 *
 * The headline "Overall" ranking on designarena.ai is composed in the browser
 * from these boards; the API rejects `category: "overall"` outright. We
 * publish the constituents rather than inventing a composite of our own.
 */
interface CategorySpec {
  arenaType: "models" | "builders" | "agents";
  category: string;
  boardId: string;
  boardName: string;
}

const CATEGORIES: readonly CategorySpec[] = [
  {
    arenaType: "models",
    category: "website",
    boardId: "design-arena-website",
    boardName: "Web Dev (non-agentic) — Website",
  },
  {
    arenaType: "agents",
    category: "fullstack",
    boardId: "design-arena-fullstack",
    boardName: "Web Dev (agentic) — Full-Stack",
  },
  {
    arenaType: "models",
    category: "gamedev",
    boardId: "design-arena-gamedev",
    boardName: "Game Dev",
  },
];

interface Row {
  modelId: string;
  elo: number;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toRow(value: unknown): Row | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const modelId = typeof raw.modelId === "string" ? raw.modelId.trim() : "";
  const elo = asFiniteNumber(raw.elo);
  if (modelId === "" || elo === null) return null;
  return { modelId, elo };
}

/** Reasoning-effort suffixes Design Arena appends to a model's own id. */
const EFFORT_SUFFIXES = ["-xhigh", "-high", "-medium", "-low", "-max", "-minimal"];

/**
 * Design Arena ids are close to ours but carry an effort suffix, and many are
 * anonymised codenames ("cortado", "grogu"). The registry is the operator's
 * own identification of those codenames — "cortado" is published there as
 * GLM-5.3 — so the registry name is tried alongside the raw id. Only exact
 * matches are taken; a codename the registry does not de-anonymise stays
 * unmapped.
 */
function resolveModelId(
  rawId: string,
  registryName: string | undefined,
  index: SlugIndex,
): string | null {
  for (const label of [rawId, registryName]) {
    if (label === undefined) continue;
    const slug = normalizeSlug(label);
    const direct = lookupSlug(index, slug);
    if (direct) return direct;
    for (const suffix of EFFORT_SUFFIXES) {
      if (slug.endsWith(suffix)) {
        const hit = lookupSlug(index, slug.slice(0, -suffix.length));
        if (hit) return hit;
      }
    }
  }
  return null;
}

/**
 * The registry maps ids to the names the site shows. It is a nicety, not a
 * requirement — if it fails we fall back to the raw id rather than failing
 * the whole source.
 */
async function fetchRegistryNames(): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  try {
    const response = await fetch(REGISTRY_ENDPOINT, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      next: { revalidate: DATA_TTL_SECONDS },
    });
    if (!response.ok) return names;
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) return names;
    const models = (payload as { models?: unknown }).models;
    if (typeof models !== "object" || models === null) return names;
    for (const [id, value] of Object.entries(models as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue;
      const displayName = (value as { displayName?: unknown }).displayName;
      if (typeof displayName === "string" && displayName.trim() !== "") {
        names.set(id, displayName.trim());
      }
    }
  } catch {
    // A missing registry only costs us prettier labels.
  }
  return names;
}

async function fetchCategory(
  spec: CategorySpec,
): Promise<{ rows: Row[]; lastUpdateTime: string | null } | string> {
  const label = `${spec.arenaType}/${spec.category}`;
  let payload: unknown;
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": USER_AGENT,
      },
      body: JSON.stringify({
        arenaType: spec.arenaType,
        category: spec.category,
      }),
      next: { revalidate: DATA_TTL_SECONDS },
    });
    if (!response.ok) {
      return `Design Arena ${label} returned HTTP ${response.status}.`;
    }
    payload = await response.json();
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return `Could not reach Design Arena for ${label}: ${reason}`;
  }

  if (typeof payload !== "object" || payload === null) {
    return `Design Arena ${label} returned a non-object body.`;
  }
  const body = payload as Record<string, unknown>;
  if (body.success !== true) {
    const message =
      typeof body.message === "string" ? body.message : "no reason given";
    return `Design Arena rejected ${label}: ${message}`;
  }
  if (!Array.isArray(body.data)) {
    return `Design Arena ${label} is missing its \`data\` array.`;
  }

  const rows = body.data
    .map(toRow)
    .filter((row): row is Row => row !== null)
    .sort((a, b) => b.elo - a.elo);
  if (rows.length === 0) {
    return `Design Arena ${label} contained no ranked rows.`;
  }

  const metadata = body.metadata;
  const lastUpdateTime =
    typeof metadata === "object" &&
    metadata !== null &&
    typeof (metadata as { lastUpdateTime?: unknown }).lastUpdateTime === "string"
      ? ((metadata as { lastUpdateTime: string }).lastUpdateTime)
      : null;

  return { rows, lastUpdateTime };
}

/**
 * Next's data cache does not cache POST requests, and this source is
 * POST-only — so without this wrapper every page render would hit
 * designarena.ai three times. unstable_cache is the documented path for
 * caching non-`fetch` work in a project not using Cache Components.
 */
async function fetchDesignArenaUncached(): Promise<LeaderboardResult> {
  try {
    const [names, settled] = await Promise.all([
      fetchRegistryNames(),
      Promise.all(CATEGORIES.map(fetchCategory)),
    ]);

    const index = await buildSlugIndex();
    const boards: Leaderboard[] = [];
    const failures: string[] = [];
    const stamps: number[] = [];

    settled.forEach((outcome, i) => {
      const spec = CATEGORIES[i];
      if (typeof outcome === "string") {
        failures.push(outcome);
        return;
      }

      // Each category is scored on its own schedule; the oldest is the honest
      // "as of" for the source as a whole.
      if (outcome.lastUpdateTime) {
        const stamp = Date.parse(outcome.lastUpdateTime);
        if (Number.isFinite(stamp)) stamps.push(stamp);
      }

      const entries: LeaderboardEntry[] = outcome.rows
        .slice(0, MAX_ENTRIES)
        .map((row, rank) => ({
          rank: rank + 1,
          modelId: resolveModelId(row.modelId, names.get(row.modelId), index),
          modelName: names.get(row.modelId) ?? row.modelId,
          score: row.elo,
        }));

      boards.push({
        id: spec.boardId,
        name: spec.boardName,
        url: PAGE_URL,
        updatedAt: outcome.lastUpdateTime ?? new Date().toISOString(),
        entries,
      });
    });

    if (failures.length > 0 || boards.length !== CATEGORIES.length) {
      return fallbackResult(
        SOURCE_ID,
        failures.join(" ") || "Design Arena returned no usable boards.",
      );
    }

    const upstreamUpdatedAt =
      stamps.length > 0 ? new Date(Math.min(...stamps)).toISOString() : null;

    return liveResult(SOURCE_ID, boards, upstreamUpdatedAt);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return fallbackResult(
      SOURCE_ID,
      `Could not parse the Design Arena leaderboard payload: ${reason}`,
    );
  }
}

const cachedFetch = unstable_cache(
  fetchDesignArenaUncached,
  ["design-arena-leaderboards"],
  { revalidate: DATA_TTL_SECONDS, tags: ["leaderboards"] },
);

export async function fetch_designarena(): Promise<LeaderboardResult> {
  return cachedFetch();
}
