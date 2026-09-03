import type { Metadata } from "next";
import Link from "next/link";
import { Card, SectionHeader } from "@/components/ui";
import {
  CuratedDataEntry,
  GitHubTrendingEntry,
  ModelCatalogEntry,
} from "@/components/sources/OtherSources";
import { SourceEntry } from "@/components/sources/SourceEntry";
import { getSources, isFragile } from "@/lib/sources";

export const metadata: Metadata = {
  title: "출처",
  description:
    "이 사이트의 모든 수치가 어디서 왔는지 정리했습니다. 리더보드마다 실제로 호출하는 엔드포인트, 수집 방식, 라이선스, 얼마나 믿을 수 있는지, 그리고 어떤 수치가 실시간이 아니라 수동 정리인지를 밝힙니다.",
};

export default function SourcesPage() {
  const sources = getSources();
  const published = sources.filter((s) => !isFragile(s));
  const fragile = sources.filter(isFragile);

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">출처</h1>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          이 사이트의 모든 수치와, 그 수치가 나온 정확한 주소, 그리고 거기에
          얼마나 무게를 실을 수 있는지를 정리했습니다.
        </p>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          여기서 가장 중요한 구분은 수치를{" "}
          <span className="text-fg">어떻게</span> 가져오는가입니다. 어떤 운영
          주체는 호출자를 위한 엔드포인트를 공개합니다. JSON API, 정적 JSON
          파일, CSV 다운로드 같은 것들입니다. 이런 것은 계약입니다. 형태가
          안정적이고, 바뀔 때는 예고가 있으며, 깨질 때는 요란하게 깨져서 우리가
          알려 드릴 수 있습니다. 나머지는 사람 눈으로 보라고 만든 페이지이고,
          우리는 그 마크업이나 그 안에 묻힌 JSON에서 숫자를 골라냅니다. 이것은
          계약이 아닙니다. 화면 개편, 필드 이름 변경, 클라이언트 렌더링으로의
          전환. 이 중 하나만 있어도 숫자는 더 이상 들어오지 않습니다. 더 나쁘게는,
          계속 들어오면서 조용히 변하지 않게 되고 아무도 통보받지 못합니다.
          그래서 아래 첫 번째 그룹의 출처는 페이지가 최신이라고 말할 때 최신이라고
          믿어도 되는 것들이고, 두 번째 그룹은 &ldquo;최신&rdquo;이 희망 사항인
          것들입니다. 두 그룹 모두{" "}
          <Link href="/leaderboards" className="text-accent hover:underline">
            /leaderboards
          </Link>
          에서 실시간 수집 상태를 보여 주니, 어느 쪽이든 인용하기 전에 거기서
          확인해야 합니다.
        </p>
        <p className="max-w-2xl text-sm leading-6 text-fg-muted">
          리더보드 아래에는 데이터셋이 셋 더 있습니다. GitHub 트렌딩과 모델
          카탈로그는 둘 다 <span className="text-good">실시간</span>입니다.
          카탈로그는 손으로 입력한 파일에서 OpenRouter의 모델 API로 옮겨 갔고,
          그래서 여기서도 옮겨 적은 것이 아니라 엔드포인트로 설명합니다. 벤치마크
          점수는 여전히{" "}
          <span className="text-warn">아무것도 가져오지 않습니다</span>. 이제 이
          둘은{" "}
          <Link href="/benchmarks" className="text-accent hover:underline">
            /benchmarks
          </Link>
          에 나란히 놓여 있습니다. 하나는 가져온 것이고 하나는 입력한 것이니,
          어느 쪽을 인용하든 어느 것이 어느 쪽인지 알아 둘 만합니다.
        </p>
      </header>

      <nav aria-label="출처 목차">
        <Card className="p-4">
          <h2 className="text-xs uppercase tracking-wide text-fg-subtle">
            이 페이지의 목차
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {sources.map((s) => (
              <li key={s.id}>
                <Link href={`#${s.id}`} className="text-accent hover:underline">
                  {s.name.split(" — ")[0]}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="#github-trending"
                className="text-accent hover:underline"
              >
                GitHub 트렌딩
              </Link>
            </li>
            <li>
              <Link
                href="#model-catalog"
                className="text-accent hover:underline"
              >
                모델 카탈로그
              </Link>
            </li>
            <li>
              <Link href="#curated" className="text-accent hover:underline">
                벤치마크 점수
              </Link>
            </li>
          </ul>
        </Card>
      </nav>

      <section className="space-y-4">
        <SectionHeader
          title="공개된 엔드포인트"
          subtitle="json-api, static-json, csv — 운영 주체가 호출자를 위해 공개한 인터페이스입니다. 이런 것이 깨지면 눈에 보이게 깨집니다."
        />
        <div className="space-y-4">
          {published.map((s) => (
            <SourceEntry key={s.id} source={s} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="스크레이핑하는 페이지"
          subtitle="scrape-embedded-json, scrape-html — 사람용으로 만든 페이지를 우리가 읽는 방식입니다. 계약도 예고도 없고, 화면이 개편되면 오류 하나 뜨지 않은 채 수치 갱신이 멈출 수 있습니다."
        />
        <div className="space-y-4">
          {fragile.map((s) => (
            <SourceEntry key={s.id} source={s} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="리더보드가 아닌 것들"
          subtitle="이 사이트의 나머지 수치입니다. 둘은 가져오고, 나머지 하나는 누군가 입력한 파일입니다."
        />
        <div className="space-y-4">
          <GitHubTrendingEntry />
          <ModelCatalogEntry />
          <CuratedDataEntry />
        </div>
      </section>

      <section>
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-fg">갱신하는 법</h2>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-fg-muted">
            <li>
              모델 카탈로그는 편집하는 것이 아니라{" "}
              <span className="text-good">가져오는</span> 것입니다.{" "}
              <span className="font-mono text-fg">src/lib/model-catalog.ts</span>
              를 보십시오. 그 옆의 두 파일은 직접 관리합니다.{" "}
              <span className="font-mono text-fg">data/model-id-map.json</span>은
              예전 수동 정리 id를 OpenRouter slug에 매핑해서 모든 벤치마크 점수와
              리더보드 행의 연결을 유지합니다.{" "}
              <span className="font-mono text-fg">
                data/models-supplement.json
              </span>
              은 OpenRouter가 등재하지 않은 몇 안 되는 모델을 담습니다.
            </li>
            <li>
              <span className="font-mono text-fg">data/benchmarks.json</span> —
              벤치마크 정의와 점수, 그리고{" "}
              <Link href="/benchmarks" className="text-accent hover:underline">
                /benchmarks
              </Link>
              의 정적 리더보드입니다.{" "}
              <span className="font-mono">BenchmarkData</span>를 따릅니다. 점수를
              건드릴 때마다 <span className="font-mono">updatedAt</span>을
              올리십시오.
            </li>
            <li>
              <span className="font-mono text-fg">
                data/leaderboards-snapshot.json
              </span>{" "}
              — 출처 id별로 마지막으로 정상이었던 보드입니다.{" "}
              <span className="text-warn">스냅샷</span> 상태의 보드가 여기로
              물러나며, 항목마다 자체{" "}
              <span className="font-mono">capturedAt</span>을 갖고 있어서 페이지가
              실시간인 척하지 않고 얼마나 오래됐는지 말할 수 있습니다.
            </li>
            <li>
              이 페이지가 렌더링하는 것은 레지스트리 자체, 곧{" "}
              <span className="font-mono text-fg">src/lib/sources.ts</span>
              입니다. 거기에 엔드포인트와 라이선스, 신뢰도 설명을 갖춰 출처를
              추가해야 여기에 나타납니다.
            </li>
            <li>
              수정한 뒤에는{" "}
              <span className="font-mono text-fg">npx tsc --noEmit</span>을
              실행하십시오. JSON은 빌드 시점에 임포트되므로 변경을 반영하려면
              배포할 때 다시 빌드해야 합니다. OpenRouter 카탈로그는 그렇지 않고,
              자체 6시간 캐시에 맞춰 알아서 갱신됩니다.
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
