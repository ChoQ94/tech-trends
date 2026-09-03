import { Badge, type BadgeTone } from "@/components/ui";
import { isFragile } from "@/lib/sources";
import type { Credibility, FetchKind, LeaderboardSource } from "@/lib/types";

/* Badges shared by /leaderboards and /sources so the same fact is never
 * rendered two different ways on two different pages. */

const CREDIBILITY_TONE: Record<Credibility, BadgeTone> = {
  high: "good",
  medium: "neutral",
  caveated: "warn",
};

const CREDIBILITY_LABEL: Record<Credibility, string> = {
  high: "신뢰도 높음",
  medium: "신뢰도 보통",
  caveated: "신뢰도 유보",
};

export function CredibilityBadge({
  credibility,
  note,
}: {
  credibility: Credibility;
  note?: string;
}) {
  return (
    <Badge tone={CREDIBILITY_TONE[credibility]} title={note}>
      {CREDIBILITY_LABEL[credibility]}
    </Badge>
  );
}

export const FETCH_KIND_LABEL: Record<FetchKind, string> = {
  "json-api": "json-api",
  "static-json": "static-json",
  csv: "csv",
  "scrape-embedded-json": "scrape-embedded-json",
  "scrape-html": "scrape-html",
};

export const FETCH_KIND_EXPLAINER: Record<FetchKind, string> = {
  "json-api": "운영 주체가 호출자를 위해 공개한 JSON 엔드포인트입니다.",
  "static-json": "사이트가 페이지 옆에 함께 올려 두는 정적 JSON 파일입니다.",
  csv: "운영 주체가 공개하는 내려받기용 CSV입니다.",
  "scrape-embedded-json":
    "페이지 HTML 속에서 캐낸 JSON입니다. 공개된 인터페이스가 아니라서, 화면이 개편되면 아무 소리 없이 깨집니다.",
  "scrape-html":
    "렌더링된 마크업에서 파싱해 낸 숫자입니다. 가장 취약한 방식이고, 화면이 개편되면 아무 소리 없이 깨집니다.",
};

export function FetchKindBadge({ kind }: { kind: FetchKind }) {
  const fragile = kind.startsWith("scrape");
  return (
    <Badge tone={fragile ? "warn" : "neutral"} title={FETCH_KIND_EXPLAINER[kind]}>
      <span className="font-mono">{FETCH_KIND_LABEL[kind]}</span>
    </Badge>
  );
}

/** Marks a board whose numbers can stop updating without anyone being told. */
export function FragileBadge({ source }: { source: LeaderboardSource }) {
  if (!isFragile(source)) return null;
  return (
    <Badge
      tone="warn"
      title={`API가 아니라 스크레이핑입니다: ${FETCH_KIND_EXPLAINER[source.fetchKind]} 이 수치들은 조용히 갱신을 멈출 수 있습니다.`}
    >
      스크레이핑
    </Badge>
  );
}
