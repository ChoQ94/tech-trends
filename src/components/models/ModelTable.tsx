import { Badge } from "@/components/ui";
import { ProviderLabel } from "@/components/models/ProviderLabel";
import { DASH, formatDate, formatTokens, formatUSD } from "@/lib/format";
import { STATUS_MEANING, statusTone } from "@/lib/model-query";
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
    ? `${formatUSD(v.pricing.input)} in / ${formatUSD(v.pricing.output)} out per 1M`
    : "no price published";
  return `${v.id} — ${price}. Same model, different billing; folded into this row rather than listed separately.`;
}

/** Dense catalog table. Wrapped in a horizontal scroller by the caller. */
export function ModelTable({ models }: { models: Model[] }) {
  const anyManual = models.some((m) => m.provenance === "manual");
  const anyVariant = models.some((m) => m.variants?.length);

  return (
    <div className="scroll-thin w-full overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <caption className="sr-only">
          AI models with provider, the date OpenRouter listed them, lifecycle
          status, context window, max output, OpenRouter&rsquo;s price per
          million tokens, and whether weights appear to be published.
        </caption>
        <thead className="border-b border-border bg-surface-2">
          <tr>
            <th scope="col" className={TH}>
              Model
            </th>
            <th scope="col" className={TH}>
              Provider
            </th>
            <th
              scope="col"
              className={TH}
              title="The date OpenRouter listed the model, which is not the date the vendor announced it. The two differ by days."
            >
              Listed
            </th>
            <th
              scope="col"
              className={TH}
              title="OpenRouter publishes no lifecycle field, so almost every row is unclassified."
            >
              Status
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Context
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Max out
            </th>
            <th
              scope="col"
              className={`${TH} text-right`}
              title="OpenRouter's price to route this model, which is not necessarily the vendor's list price."
            >
              In / 1M
            </th>
            <th
              scope="col"
              className={`${TH} text-right`}
              title="OpenRouter's price to route this model, which is not necessarily the vendor's list price."
            >
              Out / 1M
            </th>
            <th
              scope="col"
              className={`${TH} text-center`}
              title="Inferred from the presence of a HuggingFace id on the OpenRouter listing. A signal, not a licence check."
            >
              Weights
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
                      {manual ? <Badge tone="warn">manual</Badge> : null}
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
                    <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                  </span>
                  {m.retiresOn ? (
                    <span
                      className="ml-1.5 font-mono text-[10px] tabular-nums text-bad"
                      title={`OpenRouter lists a retirement date of ${m.retiresOn} for this model.`}
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
                          ? "Recorded by hand."
                          : "Inferred: the OpenRouter listing carries a HuggingFace id."
                      }
                    >
                      <Badge tone="good">open</Badge>
                    </span>
                  ) : (
                    <span
                      className="text-fg-subtle"
                      title={
                        manual
                          ? "Recorded by hand."
                          : "No HuggingFace id on the OpenRouter listing — which is weaker evidence than a published licence."
                      }
                    >
                      closed
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border bg-surface-2/60 px-3 py-2 text-[11px] leading-5 text-fg-muted">
        <span className="text-fg">Listed</span> is the date OpenRouter listed
        the model, not the date the vendor announced it.{" "}
        <span className="text-fg">Prices</span> are OpenRouter&rsquo;s, not the
        vendor&rsquo;s list price. <span className="text-fg">Weights</span> is
        inferred from a HuggingFace id on the listing, not from a licence.
        {anyVariant ? (
          <>
            {" "}
            A <span className="font-mono text-fg">:suffix</span> chip is a
            billing variant of the same model — hover it for that
            variant&rsquo;s own price.
          </>
        ) : null}
        {anyManual ? (
          <>
            {" "}
            Rows marked <span className="text-warn">manual</span> are typed by
            hand because OpenRouter does not list them; nothing refreshes them.
          </>
        ) : null}
      </p>
    </div>
  );
}
