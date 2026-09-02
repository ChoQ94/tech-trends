import type { Metadata } from "next";
import { Card, Empty, SectionHeader } from "@/components/ui";
import { LeaderboardCard } from "@/components/benchmarks/LeaderboardCard";
import { ScoreMatrix, SourceLegend } from "@/components/benchmarks/ScoreMatrix";
import {
  getLeaderboards,
  getMatrix,
  getScores,
  getSources,
  getUnjoinedScoreCount,
  getUpdatedAt,
} from "@/lib/benchmarks";
import { formatDate, relativeTime } from "@/lib/format";
import { getCatalog } from "@/lib/models";

/**
 * The matrix joins to the model catalog, which is now fetched rather than
 * imported, so this page revalidates on the catalog's own clock. Next needs
 * this as a literal; DATA_TTL_SECONDS in src/lib/cache.ts is the same number
 * and carries the reason it is six hours and not one.
 */
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Benchmarks",
  description:
    "Leaderboards and a benchmark comparison matrix across tracked AI models, with vendor-reported and independently measured scores marked separately.",
};

export default async function BenchmarksPage() {
  const leaderboards = getLeaderboards();
  const matrix = await getMatrix();
  const sources = getSources();
  const updatedAt = getUpdatedAt();
  const scoreCount = (await getScores()).length;
  const unjoined = await getUnjoinedScoreCount();
  const catalog = await getCatalog();

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Benchmarks
        </h1>
        <p className="max-w-2xl text-sm text-fg-muted">
          Benchmark numbers age badly and vendors grade their own homework. Every
          score below is shown with where it came from, and nothing is
          interpolated: if a model was never measured on a benchmark, the cell is
          empty.
        </p>
        <p className="max-w-2xl text-sm text-fg-muted">
          The scores themselves are still hand-curated and still committed to
          this repository. What changed underneath them is the{" "}
          <span className="text-fg">model</span> side of the join: the catalog
          is now fetched from OpenRouter, so every score here reaches its model
          through the committed id map in{" "}
          <span className="font-mono text-fg">data/model-id-map.json</span>.{" "}
          <span className="font-mono tabular-nums text-fg">{scoreCount}</span>{" "}
          scores resolve
          {unjoined > 0 ? (
            <>
              {" "}
              and{" "}
              <span className="font-mono tabular-nums text-bad">
                {unjoined}
              </span>{" "}
              do not — an unresolved score is dropped rather than drawn as an
              empty cell, so a broken join shows up as a missing row, not a
              wrong one
            </>
          ) : (
            <>, and none are dropped</>
          )}
          .
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <span className="text-fg-subtle">
            Data updated{" "}
            <span className="font-mono tabular-nums text-fg">
              {formatDate(updatedAt)}
            </span>
            {updatedAt ? (
              <span className="text-fg-subtle"> ({relativeTime(updatedAt)})</span>
            ) : null}
          </span>
          <span className="text-fg-subtle">
            Model names and providers from{" "}
            {catalog.live ? (
              <span className="text-good">the live OpenRouter catalog</span>
            ) : (
              <span className="text-warn">
                the committed id map — the live catalog is unavailable
              </span>
            )}
          </span>
          {sources.length > 0 ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fg-subtle">
              <span>Sources:</span>
              {sources.map((s, i) => (
                <span key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {s.name}
                  </a>
                  {i < sources.length - 1 ? (
                    <span className="text-fg-subtle">,</span>
                  ) : null}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </header>

      <section>
        <SectionHeader
          title="Leaderboards"
          subtitle="Bars are scaled within each board, not across boards — the scales are not comparable."
        />
        {leaderboards.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {leaderboards.map((lb) => (
              <LeaderboardCard key={lb.id} leaderboard={lb} />
            ))}
          </div>
        ) : (
          <Empty>No leaderboards in the dataset yet.</Empty>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Comparison matrix"
          subtitle="One row per model that has at least one published score. Shading ranks each column independently."
          action={<SourceLegend />}
        />
        {matrix.rows.length > 0 ? (
          <ScoreMatrix matrix={matrix} />
        ) : (
          <Empty>No benchmark scores in the dataset yet.</Empty>
        )}
      </section>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-fg">How to read this</h2>
        <ul className="mt-2 space-y-1.5 text-xs text-fg-muted">
          <li>
            Vendor-reported scores come from the model card or launch post of the
            company that sells the model. They are frequently measured with
            bespoke scaffolding and are not directly comparable to independent
            runs.
          </li>
          <li>
            Independently measured scores come from third-party harnesses. They
            are usually lower and usually more comparable.
          </li>
          <li>
            Arrows in the column header show the direction of &ldquo;better&rdquo;
            for that benchmark; shading follows that direction.
          </li>
          <li>
            Benchmarks have a lifecycle. A column tagged{" "}
            <span className="text-warn">saturated</span> or{" "}
            <span className="text-bad">retired</span> is kept here for continuity
            only — it no longer separates frontier models, so its scores are not
            a comparable signal next to a current benchmark. Hover the tag for
            why, and for the successor benchmark where one exists.
          </li>
          <li>
            SWE-bench Verified is the cautionary case: OpenAI stopped treating it
            as a frontier coding signal in February 2026, citing contamination
            and flawed tests. The specific audit percentages quoted around that
            decision circulate only via secondhand reports, so they are not
            repeated here as fact.
          </li>
        </ul>
      </Card>
    </div>
  );
}
