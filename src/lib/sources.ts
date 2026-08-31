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
      "Tokens processed per model through the OpenRouter API, in weekly buckets.",
    unit: "tokens",
    credibility: "caveated",
    credibilityNote:
      "The only board here measuring revealed preference rather than a score — you cannot game it without paying for the tokens. But it is not a quality ranking: it is dominated by cheap and free models, and Claude traffic largely does not route through OpenRouter, so Anthropic barely registers. Read it as a price and distribution signal.",
    conflictOfInterest:
      "OpenRouter is a paid router that earns on the traffic it ranks.",
    cadence: "Weekly buckets, updated daily.",
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
      "Abstract visual reasoning against a semi-private evaluation set, with cost per task and a human panel baseline.",
    unit: "% solved",
    credibility: "high",
    credibilityNote:
      "Structurally contamination-resistant: the ranked set is semi-private and never published. Run by a nonprofit with no lab affiliation, reports cost per task as a first-class axis, and includes a human baseline. The standing critique is that abstract visual reasoning correlates only loosely with practical usefulness.",
    conflictOfInterest: null,
    cadence: "Irregular; the payload carries its own generatedAt.",
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
      "A latent-variable composite fit across 50+ benchmarks, designed to survive the saturation of any single one.",
    unit: "ECI",
    credibility: "high",
    credibilityNote:
      "Nonprofit, no vendor money in the ranking, published as a downloadable CSV with confidence intervals on every row and minimum-benchmark thresholds to suppress noise. Because it is fit over other people's benchmarks it inherits their contamination. Note that the top entries' confidence intervals overlap — treat near-neighbours as tied, not ordered.",
    conflictOfInterest: null,
    cadence: "Continuous.",
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
      "Blind human preference between generated UIs, across web, game and full-stack categories.",
    unit: "Elo",
    credibility: "medium",
    credibilityNote:
      "Independent with genuinely large vote volume, and it has grown past single-file HTML into a real agentic harness. But it votes on the aesthetics of generated interfaces, most rows surface no error bars, and its ordering diverges sharply from capability boards. A taste signal, not a capability measure.",
    conflictOfInterest: null,
    cadence: "Hourly.",
  },
  {
    id: "terminal-bench",
    name: "Terminal-Bench 4.0",
    url: "https://www.tbench.ai/",
    endpoint: "https://www.tbench.ai/ (RSC payload embedded in the page)",
    method: "GET",
    fetchKind: "scrape-embedded-json",
    requiresAuth: false,
    license: null,
    measures:
      "Agentic terminal and CLI task completion, reported with 95% confidence intervals, cost and trial count.",
    unit: "% accuracy",
    credibility: "high",
    credibilityNote:
      "The strongest anti-gaming regime of any board here: trajectories required for passing trials, reward hacking scored zero, an open-sourced judge over every passing trial, and a canary GUID published to detect training-corpus contamination. It reports n, cost and CIs rather than a bare percentage. Its one confound is that the agent harness is not held constant across entries, so model and scaffold are entangled.",
    conflictOfInterest: null,
    cadence: "Continuous; versions ship every few months.",
  },
  {
    id: "swe-bench",
    name: "SWE-bench (Bash Only)",
    url: "https://www.swebench.com/",
    endpoint:
      'https://www.swebench.com/ (JSON in <script id="leaderboard-data">)',
    method: "GET",
    fetchKind: "scrape-embedded-json",
    requiresAuth: false,
    license: null,
    measures:
      "Resolution rate on real GitHub issues. We take the Bash Only split, which holds one scaffold constant across every model.",
    unit: "% resolved",
    credibility: "medium",
    credibilityNote:
      "Use the Bash Only split, not Verified. The Verified board is dominated by unverified self-submissions with bespoke scaffolds and multi-attempt entries, which makes it an agent-product board rather than a model comparison — the maintainers made Bash Only the default view for exactly this reason. Even so the frontier has compressed to a few points across the top ten, so it no longer discriminates well.",
    conflictOfInterest: null,
    cadence: "Irregular; submission flow has slowed.",
  },
  {
    id: "arena",
    name: "Arena (formerly LMArena)",
    url: "https://arena.ai/leaderboard",
    endpoint: "https://arena.ai/leaderboard/* (server-rendered HTML)",
    method: "GET",
    fetchKind: "scrape-html",
    requiresAuth: false,
    license: null,
    measures:
      "Human preference votes between model outputs, across text, code and agent boards.",
    unit: "Elo",
    credibility: "medium",
    credibilityNote:
      "Very large samples, published confidence intervals, and low-vote entries are marked preliminary. But it is a preference proxy rather than task success, it is subject to style and length effects, its voter population is self-selected, and some boards label the harness — so model and scaffold are confounded here too. Its ordering can disagree with capability boards; that disagreement is information, not error.",
    conflictOfInterest: null,
    cadence: "Continuous.",
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
      "Agentic coding on copyleft and commercial repositories, with a genuinely private split drawn from proprietary codebases.",
    unit: "% resolved",
    credibility: "caveated",
    credibilityNote:
      "Well designed — a private split makes it contamination-resistant, and it reports confidence intervals. Read the ranking with its ownership in mind, and note the refresh cadence has slipped.",
    conflictOfInterest:
      "Scale is majority-owned by Meta, and Meta's own model sits at #1 on SWE-bench Pro public, SWE-bench Pro private and MCP Atlas simultaneously — a pattern that appears on no independent board.",
    cadence: "Irregular; some splits months old.",
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
