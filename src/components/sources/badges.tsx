import { Badge, type BadgeTone } from "@/components/ui";
import { isFragile } from "@/lib/sources";
import type { Credibility, FetchKind, LeaderboardSource } from "@/lib/types";

/* Badges shared by /leaderboards and /sources so the same fact is never
 * rendered two different ways on two different pages. */

const CREDIBILITY_TONE: Record<Credibility, BadgeTone> = {
  high: "good",
  medium: "neutral",
  caveated: "warn",
};

const CREDIBILITY_LABEL: Record<Credibility, string> = {
  high: "high credibility",
  medium: "medium credibility",
  caveated: "caveated",
};

export function CredibilityBadge({
  credibility,
  note,
}: {
  credibility: Credibility;
  note?: string;
}) {
  return (
    <Badge tone={CREDIBILITY_TONE[credibility]} title={note}>
      {CREDIBILITY_LABEL[credibility]}
    </Badge>
  );
}

export const FETCH_KIND_LABEL: Record<FetchKind, string> = {
  "json-api": "json-api",
  "static-json": "static-json",
  csv: "csv",
  "scrape-embedded-json": "scrape-embedded-json",
  "scrape-html": "scrape-html",
};

export const FETCH_KIND_EXPLAINER: Record<FetchKind, string> = {
  "json-api": "A JSON endpoint the operator publishes for callers.",
  "static-json": "A static JSON file the site publishes next to the page.",
  csv: "A downloadable CSV the operator publishes.",
  "scrape-embedded-json":
    "JSON we dig out of the page's HTML. Not a published interface — a redesign breaks it silently.",
  "scrape-html":
    "Numbers parsed out of rendered markup. The most fragile kind — a redesign breaks it silently.",
};

export function FetchKindBadge({ kind }: { kind: FetchKind }) {
  const fragile = kind.startsWith("scrape");
  return (
    <Badge tone={fragile ? "warn" : "neutral"} title={FETCH_KIND_EXPLAINER[kind]}>
      <span className="font-mono">{FETCH_KIND_LABEL[kind]}</span>
    </Badge>
  );
}

/** Marks a board whose numbers can stop updating without anyone being told. */
export function FragileBadge({ source }: { source: LeaderboardSource }) {
  if (!isFragile(source)) return null;
  return (
    <Badge
      tone="warn"
      title={`Scraped, not an API: ${FETCH_KIND_EXPLAINER[source.fetchKind]} These numbers can silently stop updating.`}
    >
      scraped
    </Badge>
  );
}
