import { SectionHeader } from "@/components/ui";
import { RepoList } from "@/components/github/RepoList";
import { TrendingFilters } from "@/components/github/TrendingFilters";
import { fetchTrending, parseLanguage, parseWindow } from "@/lib/github";
import type { TrendingWindow } from "@/lib/types";

/**
 * Matches TRENDING_TTL_SECONDS in src/lib/github.ts, which is deliberately
 * separate from the leaderboard window; Next needs this as a literal anyway.
 */
export const revalidate = 21600;

export const metadata = {
  title: "GitHub Trending",
  description:
    "New and fast-moving GitHub repositories, derived from the GitHub Search API.",
};

const WINDOW_PHRASE: Record<TrendingWindow, string> = {
  daily: "in the last day",
  weekly: "in the last 7 days",
  monthly: "in the last 30 days",
};

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad"
    >
      {message}
    </div>
  );
}

export default async function GitHubPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const window = parseWindow(params.window);
  const language = parseLanguage(params.lang);

  const [fresh, momentum] = await Promise.all([
    fetchTrending("new", window, language),
    fetchTrending("momentum", window, language),
  ]);

  // Both lists hit the same API, so one banner covers the page.
  const error = fresh.error ?? momentum.error;
  const scope = language ? `${language} repositories` : "repositories";
  const phrase = WINDOW_PHRASE[window];

  return (
    <div>
      <SectionHeader
        title="GitHub Trending"
        subtitle="GitHub publishes no official trending API, so these lists approximate it with the GitHub Search API: repositories are ranked by total stars within a creation or push window, not by stars gained. Treat the ordering as a proxy, not as GitHub's own trending page."
      />

      <div className="mt-6">
        <TrendingFilters window={window} language={language} />
      </div>

      {error ? (
        <div className="mt-6">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      <div className="mt-8 space-y-10">
        <RepoList
          title="New & Rising"
          subtitle={`${scope} created ${phrase}, ranked by stars.`}
          result={fresh}
        />
        <RepoList
          title="Most Starred, Actively Maintained"
          subtitle={`Established ${scope} (1,000+ stars) pushed to ${phrase}, ranked by stars.`}
          result={momentum}
        />
      </div>

      <p className="mt-8 text-xs text-fg-subtle">
        Source: GitHub Search API. Cached for six hours. Star deltas are not
        exposed by this API and are therefore omitted.
      </p>
    </div>
  );
}
