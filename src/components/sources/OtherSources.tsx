import Link from "next/link";
import { Badge, Callout, Card } from "@/components/ui";
import { Field } from "@/components/sources/SourceEntry";
import { formatDate } from "@/lib/format";
import {
  CATALOG_ENDPOINT,
  CATALOG_TTL_SECONDS,
  SUPPLEMENT_MODELS,
  getIdMapSize,
} from "@/lib/model-catalog";

/**
 * Three of the five data sets on this site are not leaderboards. Two are
 * fetched — GitHub trending and, since the catalog moved to OpenRouter, the
 * model list — and one, the benchmark scores, is still a file somebody typed.
 * A page that claims to say where every number comes from has to cover all
 * three, or it is quietly the most misleading page on the site.
 */

/** The date the curated benchmark JSON was captured. */
const CURATED_CAPTURED_AT = "2026-08-31";

export function GitHubTrendingEntry() {
  return (
    <Card id="github-trending" className="scroll-mt-20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-fg">
            GitHub 트렌딩 저장소
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-muted">
            새로 생겼거나 빠르게 커지는 공개 저장소입니다.{" "}
            <Link href="/github" className="text-accent hover:underline">
              /github
            </Link>
            에서 씁니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">
            <span className="font-mono">json-api</span>
          </Badge>
          <Badge tone="good">실시간</Badge>
        </div>
      </div>

      <dl className="mt-3 divide-y divide-border border-t border-border">
        <Field label="호출하는 엔드포인트" mono>
          <span className="break-all text-fg">
            https://api.github.com/search/repositories
          </span>
        </Field>
        <Field label="메서드">
          <span className="font-mono text-fg">GET</span>
        </Field>
        <Field label="인증">
          필요 없습니다. 인증 없는 호출은 IP당 시간당{" "}
          <span className="font-mono tabular-nums text-fg">60</span>건으로
          제한되고, <span className="font-mono">GITHUB_TOKEN</span>을 설정하면{" "}
          <span className="font-mono tabular-nums text-fg">5,000</span>건까지
          늘어납니다. 스코프를 하나도 주지 않은 classic 토큰이면 충분합니다. 이
          경로는 공개 저장소 데이터만 읽습니다.
        </Field>
        <Field label="최신성">
          요청마다 가져오되, 6시간 캐시를 거칩니다.
        </Field>
      </dl>

      <div className="mt-3">
        <Callout label="한계" tone="warn">
          GitHub은 공식 트렌딩 API를 제공하지 않습니다. 여기서는 생성 시점이나
          푸시 시점으로 구간을 잡고 그 안의 저장소를{" "}
          <span className="text-fg">총 스타 수</span>로 정렬해 비슷하게 흉내 낸
          것입니다. 구간별 스타 증가분은 GitHub 자체 트렌딩 페이지가 실제로
          정렬 기준으로 쓰는 값이지만 API로 노출되지 않습니다. 그래서 여기에
          표시하지 않고, 그 자리에 지어낸 수치를 넣지도 않습니다. 이 순서는
          대리 지표로 읽어야 합니다.
        </Callout>
      </div>
    </Card>
  );
}

export function ModelCatalogEntry() {
  return (
    <Card id="model-catalog" className="scroll-mt-20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-fg">
            모델 카탈로그
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-muted">
            <Link href="/models" className="text-accent hover:underline">
              /models
            </Link>
            에 있는 모든 것, 그리고{" "}
            <Link href="/benchmarks" className="text-accent hover:underline">
              /benchmarks
            </Link>
            와{" "}
            <Link href="/leaderboards" className="text-accent hover:underline">
              /leaderboards
            </Link>
            에서 쓰는 모델 이름, 프로바이더, 링크입니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">
            <span className="font-mono">json-api</span>
          </Badge>
          <Badge tone="good">실시간</Badge>
        </div>
      </div>

      <dl className="mt-3 divide-y divide-border border-t border-border">
        <Field label="호출하는 엔드포인트" mono>
          <span className="break-all text-fg">{CATALOG_ENDPOINT}</span>
        </Field>
        <Field label="메서드">
          <span className="font-mono text-fg">GET</span>
        </Field>
        <Field label="인증">
          필요 없습니다. 키를 보내지도 않고, 필요하지도 않습니다.
        </Field>
        <Field label="최신성">
          <span className="font-mono tabular-nums text-fg">
            {CATALOG_TTL_SECONDS / 60}
          </span>
          분에 한 번 가져와 모든 방문자가 함께 씁니다. 그래서 공개 배포본이
          페이지를 볼 때마다 OpenRouter를 호출하지는 않습니다. 카탈로그 페이지에
          찍히는 시각은 캐시를 읽은 시점이 아니라 실제로 가져온 시점입니다.
        </Field>
        <Field label="라이선스">
          엔드포인트에 명시되어 있지 않습니다. 이 수치는 OpenRouter의 것으로
          보고 출처를 밝혀야 합니다.
        </Field>
        <Field label="직접 관리하는 파일" mono>
          <span className="text-fg">data/model-id-map.json</span>
          <span className="text-fg-subtle"> · </span>
          <span className="text-fg">data/models-supplement.json</span>
        </Field>
      </dl>

      <div className="mt-3 space-y-2">
        <Callout label="벤더가 하는 말이 아닙니다" tone="warn">
          /models의 네 필드는 벤더가 밝힌 사실처럼 보이지만 아닙니다.{" "}
          <span className="text-fg">날짜</span>는 OpenRouter가 그 모델을 등재한
          시점이지, 벤더가 발표한 시점이 아닙니다. 둘은 며칠씩 차이가 납니다.{" "}
          <span className="text-fg">가격</span>은 OpenRouter가 그 모델을
          라우팅하며 받는 값이라, 벤더의 정가와 일치할 이유가 없습니다.{" "}
          <span className="text-fg">가중치 공개 여부</span>는 등재 정보에
          HuggingFace id가 있는지로 추정한 것입니다. 합리적인 신호이기는 하지만
          라이선스를 확인한 결과는 아닙니다.{" "}
          <span className="text-fg">수명주기 상태</span>는 아예 공개되지 않아서
          거의 모든 모델이 <span className="text-fg">미분류</span>로
          표시됩니다. 유일한 예외는 실제 미래 시점이 담긴{" "}
          <span className="font-mono">expiration_date</span>이고, 이때만 지원
          종료로 표시합니다. 자리표시용 값은 버립니다. 일부 z-ai 행은
          &ldquo;만료 없음&rdquo;을 뜻하려고{" "}
          <span className="font-mono">2098-12-31</span>을 넣어 둡니다.
        </Callout>
        <Callout label="수동 카탈로그를 대체하며 치른 값" tone="warn">
          예전 카탈로그는 손으로 입력한 45개 모델이었고, 각 모델에 편집자가 정한{" "}
          <span className="font-mono">status</span>(flagship / current /
          preview / legacy / deprecated)와 서술형{" "}
          <span className="font-mono">note</span>가 붙어 있었습니다. API에는 둘
          다 없어서 둘 다 사라졌습니다. 이제 이 사이트에 대표 모델 화면은 없고,
          그 note가 작동시키던 가격 주의 표시는 영영 켜지지 않을 표시로 남겨
          두는 대신 아예 없앴습니다. 대신 얻은 것은 세상이 바뀌면 같이 바뀌는
          카탈로그, 그리고 45개가 아니라 수백 개의 모델입니다.
        </Callout>
        <Callout label="id는 개명이 아니라 매핑입니다" tone="neutral">
          이제 카탈로그의 키는 OpenRouter slug입니다. 하지만{" "}
          <span className="font-mono text-fg">data/benchmarks.json</span>은 예전
          수동 정리 id{" "}
          <span className="font-mono tabular-nums text-fg">
            {getIdMapSize()}
          </span>
          개를 키로 점수와 리더보드 행을 담고 있고, 실시간 수집기 여덟 개도 같은
          표에 대고 보드 이름을 맞춥니다. 이 연결이 유지되는 것은{" "}
          <span className="font-mono text-fg">data/model-id-map.json</span>이 옛
          id와 이름을 전부 별칭으로 넘겨 주기 때문입니다. 이 파일은 예전
          카탈로그를 이 엔드포인트와 대조해 한 번 생성한 뒤 사람이 검토한
          것입니다. 여기서 행을 하나 지우면 /benchmarks의 일부가 조용히 비어
          버립니다.
        </Callout>
        <Callout label="OpenRouter에 없는 다섯 모델" tone="warn">
          {SUPPLEMENT_MODELS.length}개 모델은 접근이 제한되었거나 은퇴해서
          OpenRouter 등재가 없습니다:{" "}
          <span className="text-fg">
            {SUPPLEMENT_MODELS.map((m) => m.name).join(", ")}
          </span>
          . 이들을 빼면 Google의 대표 추론 모델이 사이트에서 통째로 사라지기
          때문에,{" "}
          <span className="font-mono text-fg">data/models-supplement.json</span>
          에 남겨 두고 나타나는 곳마다 <Badge tone="warn">수동</Badge>으로
          표시합니다. 이 모델들은 아무것도 갱신해 주지 않고, 기록된 은퇴
          날짜에서 얻은 것 말고는 어떤 상태 표시도 붙이지 않습니다.
        </Callout>
      </div>
    </Card>
  );
}

export function CuratedDataEntry() {
  return (
    <Card id="curated" className="scroll-mt-20 border-warn/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-fg">
            벤치마크 점수
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-muted">
            <Link href="/benchmarks" className="text-accent hover:underline">
              /benchmarks
            </Link>
            의 비교 매트릭스와 정적 리더보드 두 개입니다. 그 옆에 붙는 모델
            이름은 위의 실시간 카탈로그에서 오지만, 숫자는 그렇지 않습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="warn">
            <span className="font-mono">수동 정리</span>
          </Badge>
          <Badge tone="bad">실시간 아님</Badge>
        </div>
      </div>

      <dl className="mt-3 divide-y divide-border border-t border-border">
        <Field label="호출하는 엔드포인트">
          <span className="text-warn">
            없습니다. 아무것도 가져오지 않습니다. 이 숫자들 뒤에는 요청이
            없습니다.
          </span>
        </Field>
        <Field label="위치" mono>
          <span className="text-fg">data/benchmarks.json</span>
        </Field>
        <Field label="캡처 시점">
          <span className="font-mono tabular-nums text-fg">
            {formatDate(CURATED_CAPTURED_AT)}
          </span>
          <span className="text-fg-subtle">
            {" "}
            — 이후로는 누가 파일을 고치지 않는 한 그대로입니다.
          </span>
        </Field>
        <Field label="갱신 주기">
          사람이 JSON을 고치고 다시 빌드할 때마다입니다. 정해진 일정도 자동화도
          없습니다.
        </Field>
      </dl>

      <div className="mt-3 space-y-2">
        <Callout label="숫자를 인용하기 전에 읽으십시오" tone="bad">
          이 파일은 사람이 손으로 옮겨 적어 저장소에 커밋한 것입니다. 피드가
          아니라 스냅샷이고, 조용히 낡습니다. 어제 점수가 수정되었더라도 그
          페이지는 알려 주지 않습니다. 거기 있는 어떤 수치도 최신이라고 가정하지
          말고, 기대기 전에 원 출처를 확인해야 합니다. 옆에 있는 모델 카탈로그는{" "}
          <span className="text-fg">실시간으로</span> 가져오기 때문에 이 차이를
          놓치기 쉽습니다. 손으로 입력한 쪽은 점수입니다.
        </Callout>
        <Callout label="왜 API가 없는가" tone="warn">
          벤치마크 점수를 공개하는 공용 API가 없습니다. 벤더는 벤치마크 표를
          출시 글의 이미지에 넣거나 자동 수집을 막는 페이지 뒤에 두고, 예고 없이
          수정합니다. 이 상황에서 고를 수 있는 정직한 선택지는 손으로 옮겨 적는
          것입니다. 이것을 피드인 척하는 쪽이 정직하지 않습니다. 모델{" "}
          <span className="text-fg">사양</span>도 OpenRouter 카탈로그가 대신하기
          전까지는 같은 처지였습니다. 위 항목에는 엔드포인트가 생겼고 이 항목에는
          아직 없는 이유가 그것입니다.
        </Callout>
      </div>
    </Card>
  );
}
