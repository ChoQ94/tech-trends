import { Badge } from "@/components/ui";
import { ProviderLabel } from "@/components/models/ProviderLabel";
import { DASH } from "@/lib/format";
import { benchmarkStatus, getBenchmarkRanges, heatFor } from "@/lib/benchmarks";
import type { Matrix } from "@/lib/benchmarks";

/**
 * Heat is a wash of the accent hue; strength = rank within the column.
 *
 * Lilac is lighter than the old pink, so the same alpha produced a lighter
 * strongest cell. The alpha now tops out at 0.40 rather than 0.44, which
 * keeps `fg` on the strongest cell at 7.99:1 and — the tighter of the two
 * — keeps the accent focus ring at 3.25:1 against that cell. Even so the
 * ramp reads *stronger* than before: the strongest cell now stands 2.02:1
 * off `surface`, against 1.88:1 under the pink.
 */
function heatStyle(heat: number): React.CSSProperties {
  return { backgroundColor: `rgba(185, 126, 236, ${(0.04 + heat * 0.36).toFixed(3)})` };
}

/**
 * Provenance is the one signal in this table with no word beside it, so it is
 * carried by shape first: a vendor score is a hollow ring, an independent one
 * a filled disc. Colour only reinforces that.
 */
function SourceDot({ source }: { source: "vendor" | "independent" }) {
  const vendor = source === "vendor";
  return (
    <span
      role="img"
      aria-label={vendor ? "vendor-reported" : "independently measured"}
      title={vendor ? "Vendor-reported" : "Independently measured"}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        vendor ? "border border-warn bg-transparent" : "bg-cyan"
      }`}
    />
  );
}

export function SourceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
      <span className="inline-flex items-center gap-1.5">
        <SourceDot source="vendor" /> vendor-reported (hollow)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <SourceDot source="independent" /> independently measured (filled)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="font-mono text-fg-subtle">
          {DASH}
        </span>{" "}
        no published score
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Badge tone="warn">saturated</Badge>
        <Badge tone="bad">retired</Badge> not a live signal
      </span>
    </div>
  );
}

export async function ScoreMatrix({ matrix }: { matrix: Matrix }) {
  const ranges = await getBenchmarkRanges();

  return (
    <div className="scroll-thin w-full overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">
          Benchmark scores by model. Cells are shaded by rank within each
          benchmark column.
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-20 min-w-[180px] border-b border-border bg-surface-2 px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-fg-subtle"
            >
              Model
            </th>
            {matrix.benchmarks.map((b) => {
              const status = benchmarkStatus(b);
              return (
                <th
                  key={b.id}
                  scope="col"
                  title={status.title}
                  className="whitespace-nowrap border-b border-border bg-surface-2 px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-fg-subtle"
                >
                  <span className="block text-fg-muted">{b.name}</span>
                  <span className="mt-0.5 flex items-center justify-end gap-1.5 font-normal normal-case">
                    <span>
                      {b.unit}
                      {b.higherIsBetter ? " ↑" : " ↓"}
                    </span>
                    {status.label ? (
                      <Badge tone={status.tone} title={status.title}>
                        {status.label}
                      </Badge>
                    ) : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map(({ model, cells }) => (
            <tr key={model.id}>
              <th
                scope="row"
                className="sticky left-0 z-10 min-w-[180px] border-b border-border/70 bg-surface px-3 py-2.5 text-left font-normal"
              >
                <span className="block truncate font-medium text-fg">
                  {model.name}
                </span>
                <ProviderLabel
                  provider={model.provider}
                  className="text-xs text-fg-subtle"
                />
              </th>
              {cells.map((cell, i) => {
                const b = matrix.benchmarks[i];
                if (!cell) {
                  return (
                    <td
                      key={b.id}
                      className="border-b border-border/70 px-3 py-2.5 text-right font-mono text-xs tabular-nums text-fg-subtle"
                    >
                      {DASH}
                    </td>
                  );
                }
                const heat = heatFor(cell.score, b, ranges.get(b.id));
                const inner = (
                  <span className="inline-flex items-center justify-end gap-1.5">
                    <SourceDot source={cell.source} />
                    <span className="font-mono tabular-nums text-fg">
                      {cell.score}
                    </span>
                  </span>
                );
                return (
                  <td
                    key={b.id}
                    style={heatStyle(heat)}
                    className="border-b border-border/70 px-3 py-2.5 text-right text-xs"
                  >
                    {cell.sourceUrl ? (
                      <a
                        href={cell.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {inner}
                      </a>
                    ) : (
                      inner
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
