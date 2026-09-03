import { Badge } from "@/components/ui";
import { formatCompact, relativeTime } from "@/lib/format";
import type { TrendingRepo } from "@/lib/types";

/**
 * Literal class strings (not built at runtime) so Tailwind's scanner keeps them.
 * Hues are approximations of GitHub's linguist colors within the token palette.
 */
const LANGUAGE_DOT: Record<string, string> = {
  TypeScript: "bg-p-google",
  JavaScript: "bg-warn",
  Python: "bg-p-meta",
  Go: "bg-cyan",
  Rust: "bg-p-anthropic",
  Java: "bg-p-alibaba",
  "C++": "bg-p-deepseek",
  C: "bg-fg-subtle",
  "C#": "bg-p-other-3",
  Ruby: "bg-bad",
  // Never the accent: on this site lilac means "interactive or primary",
  // and a language dot is neither.
  PHP: "bg-p-deepseek",
  Swift: "bg-p-mistral",
  Kotlin: "bg-p-deepseek",
  Shell: "bg-good",
  HTML: "bg-p-alibaba",
  "Jupyter Notebook": "bg-p-mistral",
  Zig: "bg-p-mistral",
};

const MAX_TOPICS = 4;

function languageDot(language: string): string {
  return LANGUAGE_DOT[language] ?? "bg-p-other";
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1" title={label}>
      <span className="font-mono tabular-nums text-fg-muted">{value}</span>
      <span className="text-fg-subtle">{label}</span>
    </span>
  );
}

export function RepoCard({ repo, rank }: { repo: TrendingRepo; rank?: number }) {
  const extraTopics = repo.topics.length - MAX_TOPICS;

  return (
    <li className="flex gap-3 border-b border-border px-4 py-3 last:border-b-0">
      {rank !== undefined ? (
        <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-xs text-fg-subtle tabular-nums">
          {rank}
        </span>
      ) : null}

      {repo.ownerAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- next/image would need remotePatterns in next.config, which is outside this scope.
        <img
          src={repo.ownerAvatar}
          alt=""
          width={28}
          height={28}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="mt-0.5 h-7 w-7 shrink-0 rounded-md border border-border bg-surface-2"
        />
      ) : (
        <span className="mt-0.5 h-7 w-7 shrink-0 rounded-md border border-border bg-surface-2" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <a
            href={repo.url}
            target="_blank"
            rel="noreferrer noopener"
            className="truncate text-sm font-medium text-fg hover:text-accent hover:underline"
          >
            <span className="text-fg-muted">{repo.owner}/</span>
            {repo.name}
          </a>
          {repo.license ? (
            <span className="text-[11px] text-fg-subtle">{repo.license}</span>
          ) : null}
        </div>

        {repo.description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-fg-muted">
            {repo.description}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {repo.language ? (
            <span className="inline-flex items-center gap-1.5 text-fg-muted">
              <span
                className={`h-2 w-2 rounded-full ${languageDot(repo.language)}`}
                aria-hidden="true"
              />
              {repo.language}
            </span>
          ) : null}
          <MetaItem label="스타" value={formatCompact(repo.stars)} />
          <MetaItem label="포크" value={formatCompact(repo.forks)} />
          <MetaItem label="이슈" value={formatCompact(repo.openIssues)} />
          <span className="text-fg-subtle" title={`생성 ${repo.createdAt}`}>
            생성 {relativeTime(repo.createdAt)}
          </span>
          <span className="text-fg-subtle" title={`푸시 ${repo.pushedAt}`}>
            푸시 {relativeTime(repo.pushedAt)}
          </span>
        </div>

        {repo.topics.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {repo.topics.slice(0, MAX_TOPICS).map((topic) => (
              <Badge key={topic} tone="neutral">
                {topic}
              </Badge>
            ))}
            {extraTopics > 0 ? (
              <Badge tone="neutral" title={repo.topics.slice(MAX_TOPICS).join(", ")}>
                +{extraTopics}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
