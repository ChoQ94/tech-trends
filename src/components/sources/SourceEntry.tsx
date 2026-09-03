import Link from "next/link";
import { Callout, Card } from "@/components/ui";
import {
  CredibilityBadge,
  FETCH_KIND_EXPLAINER,
  FetchKindBadge,
} from "@/components/sources/badges";
import { DASH } from "@/lib/format";
import type { LeaderboardSource } from "@/lib/types";

/** One label/value row. Stacks on narrow screens, aligns on wide ones. */
export function Field({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-0.5 py-1.5 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">
        {label}
      </dt>
      <dd
        className={`min-w-0 break-words text-xs leading-5 text-fg-muted ${
          mono ? "font-mono" : ""
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

export function SourceEntry({ source }: { source: LeaderboardSource }) {
  return (
    <Card id={source.id} className="scroll-mt-20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-fg">
            {source.name}
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-muted">
            {source.measures}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FetchKindBadge kind={source.fetchKind} />
          <CredibilityBadge credibility={source.credibility} />
        </div>
      </div>

      <dl className="mt-3 divide-y divide-border border-t border-border">
        <Field label="페이지">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-accent hover:underline"
          >
            {source.url}
          </a>
        </Field>
        <Field label="호출하는 엔드포인트" mono>
          <span className="break-all text-fg">{source.endpoint}</span>
        </Field>
        <Field label="메서드">
          <span className="font-mono text-fg">{source.method}</span>
        </Field>
        <Field label="수집 방식">
          <span className="font-mono text-fg">{source.fetchKind}</span>
          <span className="text-fg-subtle">
            {" "}
            — {FETCH_KIND_EXPLAINER[source.fetchKind]}
          </span>
        </Field>
        <Field label="인증">
          {source.requiresAuth ? (
            <span className="text-warn">
              저장소에 넣어 두지 않은 키가 필요합니다. 그래서 새로 받은
              체크아웃에서는 이 출처를 가져올 수 없습니다.
            </span>
          ) : (
            "필요 없습니다. 키도 계정도 쓰지 않습니다."
          )}
        </Field>
        <Field label="라이선스">
          {source.license ?? (
            <span className="text-fg-subtle">
              {DASH} 운영 주체가 밝히지 않음
            </span>
          )}
        </Field>
        <Field label="갱신 주기">{source.cadence}</Field>
        <Field label="단위">
          <span className="font-mono text-fg">{source.unit}</span>
        </Field>
        <Field label="신뢰도">{source.credibilityNote}</Field>
      </dl>

      {source.conflictOfInterest ? (
        <div className="mt-3">
          <Callout label="이해충돌" tone="warn">
            {source.conflictOfInterest}
          </Callout>
        </div>
      ) : null}

      <p className="mt-3 text-[11px]">
        <Link
          href={`/leaderboards?source=${encodeURIComponent(source.id)}`}
          className="text-accent hover:underline"
        >
          이 출처의 보드 보기 →
        </Link>
      </p>
    </Card>
  );
}
