import { Badge, Card } from "@/components/ui";
import { ProviderLabel } from "@/components/models/ProviderLabel";
import { DASH, formatDate, formatTokens, formatUSD } from "@/lib/format";
import { STATUS_MEANING, statusTone } from "@/lib/models";
import type { Model } from "@/lib/types";

/** Compact model card used on the overview. Dense by design. */
export function ModelCard({ model }: { model: Model }) {
  const price = model.pricing;
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-tight text-fg">
            {model.url ? (
              <a
                href={model.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent hover:underline"
              >
                {model.name}
              </a>
            ) : (
              model.name
            )}
          </h3>
          <ProviderLabel
            provider={model.provider}
            className="mt-1 text-xs text-fg-muted"
          />
        </div>
        <span title={STATUS_MEANING[model.status]}>
          <Badge tone={statusTone(model.status)}>{model.status}</Badge>
        </span>
      </div>

      <dl className="mt-auto grid grid-cols-3 gap-x-3 gap-y-2 border-t border-border pt-3 text-xs">
        <Field
          label="Listed"
          title="The date OpenRouter listed the model, not the date the vendor announced it."
        >
          {model.releaseDate ? formatDate(model.releaseDate) : DASH}
        </Field>
        <Field label="Context">{formatTokens(model.contextWindow)}</Field>
        <Field label="In / Out" title="OpenRouter's price per 1M tokens, not the vendor's list price.">
          {price
            ? `${formatUSD(price.input)} / ${formatUSD(price.output)}`
            : DASH}
        </Field>
      </dl>
    </Card>
  );
}

function Field({
  label,
  title,
  children,
}: {
  label: string;
  /** Every figure on this card comes from OpenRouter, not the vendor; say so. */
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt
        title={title}
        className={`text-[10px] uppercase tracking-wide text-fg-subtle ${title ? "cursor-help" : ""}`}
      >
        {label}
      </dt>
      <dd className="truncate font-mono text-xs tabular-nums text-fg">
        {children}
      </dd>
    </div>
  );
}
