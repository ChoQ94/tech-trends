import { DATA_TTL_SECONDS } from "@/lib/cache";
import {
  buildSlugIndex,
  lookupSlug,
  normalizeSlug,
  type SlugIndex,
} from "@/lib/model-match";
import { fallbackResult, liveResult } from "@/lib/snapshot";
import type { Leaderboard, LeaderboardEntry, LeaderboardResult } from "@/lib/types";

const SOURCE_ID = "openrouter-usage";
const ENDPOINT =
  "https://openrouter.ai/api/frontend/v1/rankings/model-rankings-chart";
const PAGE_URL = "https://openrouter.ai/rankings";
const USER_AGENT =
  "tech-trends-dashboard/1.0 (leaderboard aggregator; +https://openrouter.ai/rankings)";

/** Buckets are keyed by week-start; a week is only complete once it has elapsed. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The chart carries an aggregate row that is not a model and must not be ranked. */
const AGGREGATE_KEYS = new Set(["others", "other"]);

interface Bucket {
  x: string;
  ys: Record<string, number>;
}

function isBucket(value: unknown): value is Bucket {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Record<string, unknown>;
  if (typeof b.x !== "string") return false;
  if (typeof b.ys !== "object" || b.ys === null || Array.isArray(b.ys)) {
    return false;
  }
  return true;
}

/**
 * OpenRouter slugs are `org/model[-YYYYMMDD][:variant]`. Only an exact match
 * against a catalog id or name is accepted — a near miss stays unmapped
 * rather than being attributed to the wrong model.
 */
function resolveModelId(slug: string, index: SlugIndex): string | null {
  const withoutVariant = slug.split(":")[0];
  const withoutOrg = withoutVariant.includes("/")
    ? withoutVariant.slice(withoutVariant.indexOf("/") + 1)
    : withoutVariant;
  const withoutDate = withoutOrg.replace(/-\d{8}$/, "");
  return (
    lookupSlug(index, normalizeSlug(withoutOrg)) ??
    lookupSlug(index, normalizeSlug(withoutDate)) ??
    null
  );
}

/**
 * The final bucket is the week in progress — its totals are a fraction of a
 * full week and would read as a collapse in usage. Take the newest week that
 * has actually elapsed.
 */
function pickCompleteWeek(buckets: Bucket[], now: number): Bucket | null {
  const complete = buckets.filter((b) => {
    const start = Date.parse(b.x);
    return Number.isFinite(start) && start + WEEK_MS <= now;
  });
  if (complete.length === 0) return null;
  return complete.reduce((latest, b) =>
    Date.parse(b.x) > Date.parse(latest.x) ? b : latest,
  );
}

/**
 * OpenRouter slugs are `org/model[-YYYYMMDD][:variant]`. Rendering the raw
 * slug through a generic title-caser produces "Deepseek Deepseek V4 Flash
 * 20260731", so the parts are separated here instead: the model segment is
 * kept verbatim because that is its canonical, searchable name, and the date
 * and variant become qualifiers. The org is prefixed only when the model
 * segment does not already carry it — which is how `stealth/ox-alpha` keeps
 * the fact that it is an unattributed model.
 */
function displayNameForSlug(slug: string): string {
  const [org, ...rest] = slug.split("/");
  const remainder = rest.join("/") || org;
  const [beforeVariant, variant] = remainder.split(":");

  const dateMatch = beforeVariant.match(/-(\d{4})(\d{2})(\d{2})$/);
  const base = dateMatch
    ? beforeVariant.slice(0, -dateMatch[0].length)
    : beforeVariant;

  const qualifiers: string[] = [];
  if (rest.length > 0 && !base.toLowerCase().startsWith(org.toLowerCase())) {
    qualifiers.push(org);
  }
  if (dateMatch) qualifiers.push(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
  if (variant) qualifiers.push(variant);

  return qualifiers.length > 0 ? `${base} (${qualifiers.join(", ")})` : base;
}

export async function fetch_openrouter(): Promise<LeaderboardResult> {
  let payload: unknown;
  try {
    const response = await fetch(ENDPOINT, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      next: { revalidate: DATA_TTL_SECONDS },
    });
    if (!response.ok) {
      return fallbackResult(
        SOURCE_ID,
        `OpenRouter 랭킹 엔드포인트가 HTTP ${response.status}을(를) 반환했습니다.`,
      );
    }
    payload = await response.json();
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return fallbackResult(
      SOURCE_ID,
      `OpenRouter 랭킹 엔드포인트에 연결하지 못했습니다: ${reason}`,
    );
  }

  try {
    if (typeof payload !== "object" || payload === null) {
      return fallbackResult(SOURCE_ID, "OpenRouter가 객체가 아닌 본문을 반환했습니다.");
    }
    const outer = (payload as { data?: unknown }).data;
    if (typeof outer !== "object" || outer === null) {
      return fallbackResult(
        SOURCE_ID,
        "OpenRouter 페이로드에 `data` 객체가 없습니다.",
      );
    }
    const rawBuckets = (outer as { data?: unknown }).data;
    if (!Array.isArray(rawBuckets)) {
      return fallbackResult(
        SOURCE_ID,
        "OpenRouter 페이로드에 주 단위 버킷 배열이 없습니다.",
      );
    }

    const buckets = rawBuckets.filter(isBucket);
    if (buckets.length === 0) {
      return fallbackResult(
        SOURCE_ID,
        "OpenRouter가 예상한 형태의 주 단위 버킷을 반환하지 않았습니다.",
      );
    }

    const week = pickCompleteWeek(buckets, Date.now());
    if (!week) {
      return fallbackResult(
        SOURCE_ID,
        "OpenRouter 차트 데이터에 아직 완료된 주가 없습니다.",
      );
    }

    const index = await buildSlugIndex();
    const rows = Object.entries(week.ys)
      .filter(
        ([slug, tokens]) =>
          !AGGREGATE_KEYS.has(slug.trim().toLowerCase()) &&
          typeof tokens === "number" &&
          Number.isFinite(tokens),
      )
      .sort((a, b) => b[1] - a[1]);

    const entries: LeaderboardEntry[] = rows.map(([slug, tokens], i) => ({
      rank: i + 1,
      modelId: resolveModelId(slug, index),
      modelName: displayNameForSlug(slug),
      score: tokens,
    }));

    if (entries.length === 0) {
      return fallbackResult(
        SOURCE_ID,
        "OpenRouter의 가장 최근 완료된 주에 모델 행이 없습니다.",
      );
    }

    // The chart's own cache stamp is the closest thing it publishes to a
    // last-updated; the bucket label is only the week the tokens fell in.
    const cachedAt = (outer as { cachedAt?: unknown }).cachedAt;
    const upstreamUpdatedAt =
      typeof cachedAt === "number" && Number.isFinite(cachedAt)
        ? new Date(cachedAt).toISOString()
        : null;

    const board: Leaderboard = {
      id: "openrouter-weekly-tokens",
      name: `Tokens processed — week of ${week.x}`,
      url: PAGE_URL,
      updatedAt: upstreamUpdatedAt ?? new Date().toISOString(),
      entries,
    };

    return liveResult(SOURCE_ID, [board], upstreamUpdatedAt);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return fallbackResult(
      SOURCE_ID,
      `OpenRouter 랭킹 페이로드를 해석하지 못했습니다: ${reason}`,
    );
  }
}
