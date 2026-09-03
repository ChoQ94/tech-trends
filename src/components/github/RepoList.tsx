import { Card, Empty, SectionHeader } from "@/components/ui";
import { RepoCard } from "@/components/github/RepoCard";
import type { TrendingResult } from "@/lib/types";

export function RepoList({
  title,
  subtitle,
  result,
}: {
  title: string;
  subtitle: string;
  result: TrendingResult;
}) {
  return (
    <section>
      <SectionHeader title={title} subtitle={subtitle} />
      {result.repos.length === 0 ? (
        <Empty>
          {result.error
            ? "GitHub API를 사용할 수 없어 표시할 저장소가 없습니다."
            : "이 기간과 언어에 해당하는 저장소가 없습니다."}
        </Empty>
      ) : (
        <Card>
          <ul className="scroll-thin max-h-[42rem] overflow-y-auto">
            {result.repos.map((repo, i) => (
              <RepoCard key={repo.id} repo={repo} rank={i + 1} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
