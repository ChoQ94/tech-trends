import type { TrendingRepo, TrendingResult, TrendingWindow } from "@/lib/types";

const SEARCH_ENDPOINT = "https://api.github.com/search/repositories";
const PER_PAGE = 30;

/**
 * "new" approximates the trending page: repos created inside the window,
 * ranked by stars. "momentum" surfaces established repos still being worked on.
 */
export type TrendingMode = "new" | "momentum";

export const TRENDING_WINDOWS: readonly TrendingWindow[] = [
  "daily",
  "weekly",
  "monthly",
];

const WINDOW_DAYS: Record<TrendingWindow, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

export const WINDOW_LABELS: Record<TrendingWindow, string> = {
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
};

export interface LanguageOption {
  /** GitHub's `language:` qualifier value. */
  value: string;
  label: string;
}

/** Curated shortlist for the filter UI; GitHub supports far more. */
export const LANGUAGES: readonly LanguageOption[] = [
  { value: "TypeScript", label: "TypeScript" },
  { value: "JavaScript", label: "JavaScript" },
  { value: "Python", label: "Python" },
  { value: "Go", label: "Go" },
  { value: "Rust", label: "Rust" },
  { value: "Java", label: "Java" },
  { value: "C++", label: "C++" },
  { value: "C#", label: "C#" },
  { value: "Ruby", label: "Ruby" },
  { value: "Swift", label: "Swift" },
  { value: "Kotlin", label: "Kotlin" },
  { value: "Zig", label: "Zig" },
];

export function isTrendingWindow(value: unknown): value is TrendingWindow {
  return value === "daily" || value === "weekly" || value === "monthly";
}

export function parseWindow(value: string | string[] | undefined): TrendingWindow {
  const raw = Array.isArray(value) ? value[0] : value;
  return isTrendingWindow(raw) ? raw : "weekly";
}

export function parseLanguage(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const match = LANGUAGES.find((l) => l.value.toLowerCase() === raw.toLowerCase());
  return match ? match.value : null;
}

/** GitHub search date qualifiers take a plain YYYY-MM-DD cutoff. */
function cutoffDate(window: TrendingWindow): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS[window]);
  return d.toISOString().slice(0, 10);
}

function buildQuery(
  mode: TrendingMode,
  window: TrendingWindow,
  language: string | null,
): string {
  const since = cutoffDate(window);
  const parts =
    mode === "new"
      ? [`created:>${since}`]
      : [`pushed:>${since}`, "stars:>1000"];
  if (language) parts.push(`language:${language}`);
  return parts.join(" ");
}

interface RawOwner {
  login?: string;
  avatar_url?: string | null;
}

interface RawLicense {
  spdx_id?: string | null;
  name?: string | null;
}

interface RawRepo {
  id: number;
  full_name: string;
  name: string;
  owner: RawOwner | null;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics?: string[];
  created_at: string;
  pushed_at: string;
  license: RawLicense | null;
}

interface RawSearchResponse {
  items?: RawRepo[];
}

function toTrendingRepo(raw: RawRepo): TrendingRepo {
  const owner = raw.owner?.login ?? raw.full_name.split("/")[0] ?? "";
  const license = raw.license?.spdx_id;
  return {
    id: raw.id,
    fullName: raw.full_name,
    owner,
    name: raw.name,
    description: raw.description,
    url: raw.html_url,
    homepage: raw.homepage && raw.homepage.length > 0 ? raw.homepage : null,
    language: raw.language,
    stars: raw.stargazers_count,
    // The Search API returns only a current star total, never a per-window
    // delta, so there is nothing honest to put here.
    starsGained: null,
    forks: raw.forks_count,
    openIssues: raw.open_issues_count,
    topics: raw.topics ?? [],
    createdAt: raw.created_at,
    pushedAt: raw.pushed_at,
    ownerAvatar: raw.owner?.avatar_url ?? null,
    license: license && license !== "NOASSERTION" ? license : null,
  };
}

const RATE_LIMIT_MESSAGE =
  "GitHub API rate limit exceeded — set GITHUB_TOKEN to raise the limit from 60 to 5,000 requests/hour.";

function isRateLimited(response: Response): boolean {
  if (response.status === 429) return true;
  // GitHub signals a primary rate limit with 403 + a zeroed remaining header.
  return (
    response.status === 403 &&
    response.headers.get("x-ratelimit-remaining") === "0"
  );
}

export async function fetchTrending(
  mode: TrendingMode,
  window: TrendingWindow,
  language: string | null = null,
): Promise<TrendingResult> {
  const params = new URLSearchParams({
    q: buildQuery(mode, window, language),
    sort: "stars",
    order: "desc",
    per_page: String(PER_PAGE),
  });

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const base: Omit<TrendingResult, "repos" | "error"> = {
    window,
    language,
    fetchedAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${SEARCH_ENDPOINT}?${params}`, {
      headers,
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      const error = isRateLimited(response)
        ? RATE_LIMIT_MESSAGE
        : `GitHub API returned ${response.status} ${response.statusText}.`;
      return { ...base, repos: [], error };
    }

    const data = (await response.json()) as RawSearchResponse;
    return { ...base, repos: (data.items ?? []).map(toTrendingRepo), error: null };
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "unknown error";
    return {
      ...base,
      repos: [],
      error: `Could not reach the GitHub API (${detail}).`,
    };
  }
}
