import { Badge } from "@/components/ui";
import { ProviderLabel } from "@/components/models/ProviderLabel";
import { DASH, formatDate, formatTokens, formatUSD } from "@/lib/format";
import { STATUS_LABEL, STATUS_MEANING, statusTone } from "@/lib/model-query";
import type { Model, ModelVariant } from "@/lib/types";

const TH =
  "whitespace-nowrap px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-fg-subtle";
const TD = "whitespace-nowrap px-3 py-2.5 align-middle";
/** The name cell carries wrapping variant and note text, so it must not be nowrap. */
const TD_NAME = "px-3 py-2.5 align-top";
const NUM = `${TD} text-right font-mono tabular-nums`;

/**
 * A billing variant is the same model at a different price. Its own price is
 * the whole point of showing it, so it goes in the title rather than being
 * left as a bare word.
 */
function variantTitle(v: ModelVariant): string {
  const price = v.pricing
    ? `1M당 입력 ${formatUSD(v.pricing.input)} / 출력 ${formatUSD(v.pricing.output)}`
    : "가격 미공개";
  return `${v.id} — ${price}. 같은 모델이고 과금만 다릅니다. 따로 표시하지 않고 이 행에 합쳤습니다.`;
}

/** Dense catalog table. Wrapped in a horizontal scroller by the caller. */
export function ModelTable({ models }: { models: Model[] }) {
  const anyManual = models.some((m) => m.provenance === "manual");
  const anyVariant = models.some((m) => m.variants?.length);

  return (
    <div className="scroll-thin w-full overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <caption className="sr-only">
          AI 모델 목록. 프로바이더, OpenRouter가 등재한 날짜, 수명주기 상태,
          컨텍스트 윈도우, 최대 출력, OpenRouter의 100만 토큰당 가격, 그리고
          가중치가 공개된 것으로 보이는지 여부를 담고 있습니다.
        </caption>
        <thead className="border-b border-border bg-surface-2">
          <tr>
            <th scope="col" className={TH}>
              모델
            </th>
            <th scope="col" className={TH}>
              프로바이더
            </th>
            <th
              scope="col"
              className={TH}
              title="OpenRouter가 이 모델을 등재한 날짜이지, 벤더가 발표한 날짜가 아닙니다. 둘은 며칠씩 차이가 납니다."
            >
              등재
            </th>
            <th
              scope="col"
              className={TH}
              title="OpenRouter가 수명주기 필드를 제공하지 않아서 거의 모든 행이 미분류입니다."
            >
              상태
            </th>
            <th scope="col" className={`${TH} text-right`}>
              컨텍스트
            </th>
            <th scope="col" className={`${TH} text-right`}>
              최대 출력
            </th>
            <th
              scope="col"
              className={`${TH} text-right`}
              title="OpenRouter가 이 모델을 라우팅하는 가격이며, 벤더의 정가와 반드시 같지는 않습니다."
            >
              입력/1M
            </th>
            <th
              scope="col"
              className={`${TH} text-right`}
              title="OpenRouter가 이 모델을 라우팅하는 가격이며, 벤더의 정가와 반드시 같지는 않습니다."
            >
              출력/1M
            </th>
            <th
              scope="col"
              className={`${TH} text-center`}
              title="OpenRouter 등재 정보에 HuggingFace id가 있는지로 추정합니다. 라이선스를 확인한 것이 아니라 하나의 신호일 뿐입니다."
            >
              가중치
            </th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => {
            const manual = m.provenance === "manual";
            return (
              <tr
                key={m.id}
                className="border-b border-border/70 last:border-0 hover:bg-surface-2/60"
              >
                <th
                  scope="row"
                  className={`${TD_NAME} w-[24rem] min-w-[16rem] max-w-[24rem] text-left font-normal`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-fg">
                      {m.url ? (
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-accent hover:underline"
                        >
                          {m.name}
                        </a>
                      ) : (
                        m.name
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
                      <span>{m.family}</span>
                      {m.variants?.map((v) => (
                        <span
                          key={v.id}
                          title={variantTitle(v)}
                          className="cursor-help rounded border border-border px-1 font-mono text-[10px] text-fg-muted"
                        >
                          :{v.suffix}
                        </span>
                      ))}
                      {manual ? <Badge tone="warn">수동</Badge> : null}
                    </span>
                    {m.notes ? (
                      <span className="mt-1 text-[11px] leading-4 text-fg-muted">
                        {m.notes}
                      </span>
                    ) : null}
                  </div>
                </th>
                <td className={`${TD} text-fg-muted`}>
                  <ProviderLabel provider={m.provider} />
                </td>
                <td
                  className={`${TD} font-mono text-xs tabular-nums text-fg-muted`}
                >
                  {m.releaseDate ? formatDate(m.releaseDate) : DASH}
                </td>
                <td className={TD}>
                  <span title={STATUS_MEANING[m.status]}>
                    <Badge tone={statusTone(m.status)}>
                      {STATUS_LABEL[m.status]}
                    </Badge>
                  </span>
                  {m.retiresOn ? (
                    <span
                      className="ml-1.5 font-mono text-[10px] tabular-nums text-bad"
                      title={`OpenRouter에 등재된 이 모델의 종료 날짜는 ${m.retiresOn}입니다.`}
                    >
                      {m.retiresOn}
                    </span>
                  ) : null}
                </td>
                <td className={`${NUM} text-fg`}>
                  {formatTokens(m.contextWindow)}
                </td>
                <td className={`${NUM} text-fg-muted`}>
                  {formatTokens(m.maxOutput)}
                </td>
                <td className={`${NUM} text-fg`}>
                  {m.pricing ? formatUSD(m.pricing.input) : DASH}
                </td>
                <td className={`${NUM} text-fg`}>
                  {m.pricing ? formatUSD(m.pricing.output) : DASH}
                </td>
                <td className={`${TD} text-center`}>
                  {m.openWeights ? (
                    <span
                      title={
                        manual
                          ? "수동으로 기록했습니다."
                          : "추정: OpenRouter 등재 정보에 HuggingFace id가 있습니다."
                      }
                    >
                      <Badge tone="good">공개</Badge>
                    </span>
                  ) : (
                    <span
                      className="text-fg-subtle"
                      title={
                        manual
                          ? "수동으로 기록했습니다."
                          : "OpenRouter 등재 정보에 HuggingFace id가 없습니다 — 공개된 라이선스보다 약한 근거입니다."
                      }
                    >
                      비공개
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border bg-surface-2/60 px-3 py-2 text-[11px] leading-5 text-fg-muted">
        <span className="text-fg">등재</span>는 OpenRouter가 모델을 등재한
        날짜이지, 벤더가 발표한 날짜가 아닙니다.{" "}
        <span className="text-fg">가격</span>은 OpenRouter의 가격이지, 벤더의
        정가가 아닙니다. <span className="text-fg">가중치</span>는 등재 정보에
        HuggingFace id가 있는지로 추정한 것이지, 라이선스를 확인한 결과가
        아닙니다.
        {anyVariant ? (
          <>
            {" "}
            <span className="font-mono text-fg">:suffix</span> 칩은 같은 모델의
            과금 변형입니다 — 마우스를 올리면 그 변형의 가격을 볼 수 있습니다.
          </>
        ) : null}
        {anyManual ? (
          <>
            {" "}
            <span className="text-warn">수동</span>으로 표시된 행은 OpenRouter가
            등재하지 않아 손으로 입력한 것이며, 자동으로 갱신되지 않습니다.
          </>
        ) : null}
      </p>
    </div>
  );
}
