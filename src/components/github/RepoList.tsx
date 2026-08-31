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
            ? "No repositories to show while the GitHub API is unavailable."
            : "No repositories matched this window and language."}
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
