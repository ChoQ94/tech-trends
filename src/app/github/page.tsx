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
  title: "GitHub 트렌딩",
  description:
    "GitHub Search API로 뽑아낸, 새로 생겼거나 빠르게 움직이는 GitHub 저장소입니다.",
};

const WINDOW_PHRASE: Record<TrendingWindow, string> = {
  daily: "최근 하루",
  weekly: "최근 7일",
  monthly: "최근 30일",
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
  const scope = language ? `${language} 저장소` : "저장소";
  const phrase = WINDOW_PHRASE[window];

  return (
    <div>
      <SectionHeader
        title="GitHub 트렌딩"
        subtitle="GitHub은 공식 트렌딩 API를 제공하지 않습니다. 그래서 이 목록은 GitHub Search API로 근사한 결과입니다. 생성 또는 푸시 기간 안에서 늘어난 스타가 아니라 누적 스타로 순위를 매깁니다. 이 순서는 GitHub 자체 트렌딩 페이지가 아니라 그 대용이라고 보시기 바랍니다."
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
          title="신규·급상승"
          subtitle={`${phrase} 동안 생성된 ${scope}를 스타 수 순으로 나열했습니다.`}
          result={fresh}
        />
        <RepoList
          title="스타 많고 지금도 관리되는 저장소"
          subtitle={`스타 1,000개 이상인 기존 ${scope} 중 ${phrase} 안에 푸시된 것을 스타 수 순으로 나열했습니다.`}
          result={momentum}
        />
      </div>

      <p className="mt-8 text-xs text-fg-subtle">
        출처는 GitHub Search API이고 6시간 동안 캐시합니다. 기간별 스타 증감은 이
        API가 제공하지 않으므로 표시하지 않습니다.
      </p>
    </div>
  );
}
