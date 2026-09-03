import type { LeaderboardSource } from "@/lib/types";

/**
 * The registry of every leaderboard we pull, and what we know about each.
 *
 * `fetchKind` is the important column. A "json-api" or "static-json" source
 * is something the operator publishes for callers and can be relied on. A
 * "scrape-*" source is us reading numbers out of a page built for humans:
 * it works until the site is redesigned, and then it stops working without
 * anyone being told. Those are marked so the sources page can say so.
 */
export const LEADERBOARD_SOURCES: readonly LeaderboardSource[] = [
  {
    id: "openrouter-usage",
    name: "OpenRouter — model usage rankings",
    url: "https://openrouter.ai/rankings",
    endpoint:
      "https://openrouter.ai/api/frontend/v1/rankings/model-rankings-chart",
    method: "GET",
    fetchKind: "json-api",
    requiresAuth: false,
    license: "CC BY 4.0",
    measures:
      "OpenRouter API를 거쳐 모델별로 처리된 tokens을 주 단위로 묶어 집계한 수치입니다.",
    unit: "tokens",
    credibility: "caveated",
    credibilityNote:
      "여기 있는 보드 중 점수가 아니라 드러난 선호를 측정하는 유일한 보드입니다. tokens 값을 치르지 않고는 조작할 수 없습니다. 다만 품질 순위는 아닙니다. 저가 모델과 무료 모델이 순위를 장악하고 있고, Claude 트래픽은 대부분 OpenRouter를 거치지 않아 Anthropic은 거의 잡히지 않습니다. 가격과 유통 경로를 알려 주는 신호로 읽어야 합니다.",
    conflictOfInterest:
      "OpenRouter는 자신이 순위를 매기는 그 트래픽에서 수익을 얻는 유료 라우터입니다.",
    cadence: "주 단위로 묶어 매일 갱신합니다.",
  },
  {
    id: "arc-prize",
    name: "ARC Prize — ARC-AGI-2 / ARC-AGI-3",
    url: "https://arcprize.org/leaderboard",
    endpoint: "https://arcprize.org/media/data/leaderboard/v2.json",
    method: "GET",
    fetchKind: "static-json",
    requiresAuth: false,
    license: null,
    measures:
      "일부만 공개된(semi-private) 평가셋에 대한 추상 시각 추론을 측정합니다. 과제당 비용과 사람 패널 기준선을 함께 제공합니다.",
    unit: "% solved",
    credibility: "high",
    credibilityNote:
      "구조적으로 오염에 강합니다. 순위 산정에 쓰는 평가셋은 일부만 공개되며 전부 공개된 적이 없습니다. 특정 연구소에 속하지 않은 비영리 단체가 운영하고, 과제당 비용을 일급 축으로 보고하며, 사람 기준선도 포함합니다. 다만 추상 시각 추론이 실용적 유용성과는 느슨하게만 상관한다는 비판이 계속 따라붙습니다.",
    conflictOfInterest: null,
    cadence: "비정기적입니다. 페이로드에 자체 generatedAt이 들어 있습니다.",
  },
  {
    id: "epoch-eci",
    name: "Epoch AI — Capabilities Index (ECI)",
    url: "https://epoch.ai/data/ai-benchmarking-dashboard",
    endpoint: "https://epoch.ai/data/eci_scores.csv",
    method: "GET",
    fetchKind: "csv",
    requiresAuth: false,
    license: "CC BY",
    measures:
      "50개가 넘는 벤치마크에 걸쳐 적합시킨 잠재변수 종합 지표입니다. 어느 한 벤치마크가 포화되더라도 견디도록 설계되었습니다.",
    unit: "ECI",
    credibility: "high",
    credibilityNote:
      "비영리이고 순위에 벤더 자금이 들어가 있지 않습니다. 모든 행에 신뢰구간을 붙이고 노이즈를 걸러내는 최소 벤치마크 수 기준을 적용한 CSV로 내려받게 공개합니다. 다만 남의 벤치마크 위에 적합시킨 지표라서 그 오염을 그대로 물려받습니다. 상위 항목들의 신뢰구간은 서로 겹칩니다. 근소한 차이의 이웃은 순서가 있다고 보지 말고 동률로 취급해야 합니다.",
    conflictOfInterest: null,
    cadence: "상시 갱신합니다.",
  },
  {
    id: "design-arena",
    name: "Design Arena",
    url: "https://www.designarena.ai/",
    endpoint: "https://www.designarena.ai/api/leaderboard",
    method: "POST",
    fetchKind: "json-api",
    requiresAuth: false,
    license: null,
    measures:
      "생성된 UI들 사이의 블라인드 사람 선호도를 웹, 게임, 풀스택 카테고리에 걸쳐 측정합니다.",
    unit: "Elo",
    credibility: "medium",
    credibilityNote:
      "독립적으로 운영되고 투표 수도 실제로 많으며, 단일 파일 HTML 수준을 넘어 제대로 된 에이전트 하네스로 발전했습니다. 다만 투표 대상은 생성된 인터페이스의 미감이고, 대부분의 행에 오차 막대가 나타나지 않으며, 순위는 능력 보드들과 크게 어긋납니다. 능력 측정치가 아니라 취향 신호입니다.",
    conflictOfInterest: null,
    cadence: "매시간 갱신합니다.",
  },
  {
    id: "terminal-bench",
    name: "Terminal-Bench 4.0",
    url: "https://www.tbench.ai/",
    endpoint: "https://www.tbench.ai/ (페이지에 포함된 RSC 페이로드)",
    method: "GET",
    fetchKind: "scrape-embedded-json",
    requiresAuth: false,
    license: null,
    measures:
      "에이전트의 터미널·CLI 과제 완수율입니다. 95% 신뢰구간, 비용, 시도 횟수와 함께 보고합니다.",
    unit: "% accuracy",
    credibility: "high",
    credibilityNote:
      "여기 있는 보드 중 조작 방지 장치가 가장 강력합니다. 통과한 시도는 실행 궤적 제출을 요구하고, 리워드 해킹은 0점 처리하며, 통과한 모든 시도를 오픈소스로 공개한 심사기로 검증하고, 학습 코퍼스 오염을 탐지하려고 canary GUID를 공개해 둡니다. 맨 퍼센트 하나가 아니라 n과 비용, 신뢰구간을 함께 보고합니다. 유일한 교란 요인은 항목마다 에이전트 하네스가 동일하게 고정되지 않는다는 점입니다. 그래서 모델과 스캐폴드가 뒤엉켜 있습니다.",
    conflictOfInterest: null,
    cadence: "상시 갱신합니다. 버전은 몇 달에 한 번씩 나옵니다.",
  },
  {
    id: "swe-bench",
    name: "SWE-bench (Bash Only)",
    url: "https://www.swebench.com/",
    endpoint:
      'https://www.swebench.com/ (<script id="leaderboard-data"> 안의 JSON)',
    method: "GET",
    fetchKind: "scrape-embedded-json",
    requiresAuth: false,
    license: null,
    measures:
      "실제 GitHub 이슈의 해결률입니다. 모든 모델에 스캐폴드 하나를 똑같이 고정해 두는 Bash Only 스플릿을 가져옵니다.",
    unit: "% resolved",
    credibility: "medium",
    credibilityNote:
      "Verified가 아니라 Bash Only 스플릿을 봐야 합니다. Verified 보드는 검증되지 않은 자체 제출이 장악하고 있고, 각자 맞춰 만든 스캐폴드와 여러 번 시도한 항목이 섞여 있습니다. 그래서 모델 비교가 아니라 에이전트 제품 비교 보드가 됩니다. 관리자들이 Bash Only를 기본 화면으로 바꾼 이유도 정확히 이것입니다. 그럼에도 상위 10개의 격차가 몇 점 안으로 좁혀져서, 이제는 변별력이 떨어집니다.",
    conflictOfInterest: null,
    cadence: "비정기적입니다. 제출 유입이 느려졌습니다.",
  },
  {
    id: "arena",
    name: "Arena (formerly LMArena)",
    url: "https://arena.ai/leaderboard",
    endpoint: "https://arena.ai/leaderboard/* (서버 렌더링된 HTML)",
    method: "GET",
    fetchKind: "scrape-html",
    requiresAuth: false,
    license: null,
    measures:
      "모델 출력 사이의 사람 선호 투표를 텍스트, 코드, 에이전트 보드에 걸쳐 집계합니다.",
    unit: "Elo",
    credibility: "medium",
    credibilityNote:
      "표본이 매우 크고 신뢰구간을 공개하며, 투표 수가 적은 항목은 잠정으로 표시합니다. 다만 과제 성공이 아니라 선호도를 대신 재는 지표이고, 문체와 길이의 영향을 받으며, 투표자 집단은 스스로 모여든 사람들입니다. 게다가 일부 보드는 하네스를 함께 표기합니다. 여기서도 모델과 스캐폴드가 뒤섞여 있다는 뜻입니다. 순위가 능력 보드들과 어긋날 수 있는데, 그 불일치는 오류가 아니라 정보입니다.",
    conflictOfInterest: null,
    cadence: "상시 갱신합니다.",
  },
  {
    id: "scale-swe-bench-pro",
    name: "Scale — SWE-bench Pro",
    url: "https://labs.scale.com/leaderboard/swe_bench_pro_public",
    endpoint: "https://labs.scale.com/leaderboard/swe_bench_pro_public",
    method: "GET",
    fetchKind: "scrape-html",
    requiresAuth: false,
    license: null,
    measures:
      "카피레프트 저장소와 상용 저장소를 대상으로 한 에이전트 코딩 능력입니다. 독점 코드베이스에서 뽑은 진짜 비공개 스플릿을 포함합니다.",
    unit: "% resolved",
    credibility: "caveated",
    credibilityNote:
      "설계는 좋습니다. 비공개 스플릿 덕분에 오염에 강하고 신뢰구간도 보고합니다. 다만 순위는 이 보드의 소유 관계를 염두에 두고 읽어야 하고, 갱신 주기가 느려졌다는 점도 함께 봐야 합니다.",
    conflictOfInterest:
      "Scale의 지분 과반은 Meta가 가지고 있습니다. 그리고 Meta 자사 모델이 SWE-bench Pro public, SWE-bench Pro private, MCP Atlas에서 동시에 1위입니다. 어떤 독립 보드에서도 나타나지 않는 양상입니다.",
    cadence: "비정기적입니다. 일부 스플릿은 몇 달 전 것입니다.",
  },
] as const;

export function getSources(): readonly LeaderboardSource[] {
  return LEADERBOARD_SOURCES;
}

export function getSource(id: string): LeaderboardSource | undefined {
  return LEADERBOARD_SOURCES.find((s) => s.id === id);
}

/** Sources we call an endpoint for, versus ones we pick a page apart. */
export function isFragile(source: LeaderboardSource): boolean {
  return source.fetchKind.startsWith("scrape");
}
