import { Badge, Card } from "@/components/ui";
import { ProviderLabel } from "@/components/models/ProviderLabel";
import { DASH, formatDate } from "@/lib/format";
import type { FamilyGroup } from "@/lib/models";

/**
 * What replaced the lineage view.
 *
 * Lineage grouped a family around its flagship and its retired members. Both
 * of those were editorial judgements typed into the old catalog, and
 * OpenRouter publishes neither — so a section built on them would now be a
 * grid of empty cards, or worse, a guess dressed as a succession.
 *
 * What is still true, and still worth showing, is that OpenRouter lists
 * `claude-opus-5`, `claude-opus-5-fast` and `claude-opus-4.8` as three
 * unrelated ids. Grouping them by the stem of their slug says only "these
 * share a name", which is exactly as much as we know — and it is the thing
 * that stops the catalog reading as several hundred unrelated rows.
 */
const MAX_ROWS = 8;

export function Families({
  families,
  limit,
}: {
  families: FamilyGroup[];
  /** Families shown before the tail is dropped; the catalog has hundreds. */
  limit?: number;
}) {
  const shown = limit ? families.slice(0, limit) : families;
  if (shown.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((f) => (
        <Card key={`${f.provider}-${f.family}`} className="p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-fg">
              {f.family}
            </h3>
            <ProviderLabel
              provider={f.provider}
              className="shrink-0 text-xs text-fg-muted"
            />
          </div>
          <ol className="mt-3 space-y-1.5">
            {f.models.slice(0, MAX_ROWS).map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="shrink-0 font-mono tabular-nums text-fg-subtle"
                    title="The date OpenRouter listed this model."
                  >
                    {m.releaseDate ? formatDate(m.releaseDate) : DASH}
                  </span>
                  <span className="truncate text-fg-muted">{m.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {m.variants?.map((v) => (
                    <span
                      key={v.id}
                      title={`Also listed as ${v.id} — the same model at a different price.`}
                      className="rounded border border-border px-1 font-mono text-[10px] text-fg-subtle"
                    >
                      :{v.suffix}
                    </span>
                  ))}
                  {m.provenance === "manual" ? (
                    <Badge tone="warn">manual</Badge>
                  ) : null}
                  {m.retiresOn ? <Badge tone="bad">retiring</Badge> : null}
                </span>
              </li>
            ))}
            {f.models.length > MAX_ROWS ? (
              <li className="pt-0.5 text-xs text-fg-subtle">
                +{f.models.length - MAX_ROWS} more in this family
              </li>
            ) : null}
          </ol>
          <p className="mt-3 border-t border-border pt-2 text-[11px] leading-4 text-fg-subtle">
            Grouped by the stem of the OpenRouter id. Ordering is by listing
            date, and implies nothing about which model replaced which.
          </p>
        </Card>
      ))}
    </div>
  );
}
