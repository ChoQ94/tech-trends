import Link from "next/link";
import { Badge, Callout, Card } from "@/components/ui";
import { Field } from "@/components/sources/SourceEntry";
import { formatDate } from "@/lib/format";
import {
  CATALOG_ENDPOINT,
  CATALOG_TTL_SECONDS,
  SUPPLEMENT_MODELS,
  getIdMapSize,
} from "@/lib/model-catalog";

/**
 * Three of the five data sets on this site are not leaderboards. Two are
 * fetched — GitHub trending and, since the catalog moved to OpenRouter, the
 * model list — and one, the benchmark scores, is still a file somebody typed.
 * A page that claims to say where every number comes from has to cover all
 * three, or it is quietly the most misleading page on the site.
 */

/** The date the curated benchmark JSON was captured. */
const CURATED_CAPTURED_AT = "2026-08-31";

export function GitHubTrendingEntry() {
  return (
    <Card id="github-trending" className="scroll-mt-20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-fg">
            GitHub trending repositories
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-muted">
            New and fast-moving public repositories, used by{" "}
            <Link href="/github" className="text-accent hover:underline">
              /github
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">
            <span className="font-mono">json-api</span>
          </Badge>
          <Badge tone="good">live</Badge>
        </div>
      </div>

      <dl className="mt-3 divide-y divide-border border-t border-border">
        <Field label="Endpoint we call" mono>
          <span className="break-all text-fg">
            https://api.github.com/search/repositories
          </span>
        </Field>
        <Field label="Method">
          <span className="font-mono text-fg">GET</span>
        </Field>
        <Field label="Auth">
          Not required. Unauthenticated calls are capped at{" "}
          <span className="font-mono tabular-nums text-fg">60</span> requests per
          hour per IP; setting <span className="font-mono">GITHUB_TOKEN</span>{" "}
          raises that to{" "}
          <span className="font-mono tabular-nums text-fg">5,000</span>. A
          classic token with no scopes at all is enough — the route reads only
          public repository data.
        </Field>
        <Field label="Freshness">
          Fetched at request time, so it is genuinely current.
        </Field>
      </dl>

      <div className="mt-3">
        <Callout label="Limitation" tone="warn">
          GitHub publishes no official trending API. This approximates one by
          ranking repositories on <span className="text-fg">total stars</span>{" "}
          within a creation or push window. Per-window star deltas — the thing
          GitHub&rsquo;s own trending page actually sorts on — are not exposed by
          the API, so they are not shown here and no figure is invented for them.
          Read the ordering as a proxy.
        </Callout>
      </div>
    </Card>
  );
}

export function ModelCatalogEntry() {
  return (
    <Card id="model-catalog" className="scroll-mt-20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-fg">
            Model catalog
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-muted">
            Everything on{" "}
            <Link href="/models" className="text-accent hover:underline">
              /models
            </Link>
            , and the model names, providers and links used on{" "}
            <Link href="/benchmarks" className="text-accent hover:underline">
              /benchmarks
            </Link>{" "}
            and{" "}
            <Link href="/leaderboards" className="text-accent hover:underline">
              /leaderboards
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">
            <span className="font-mono">json-api</span>
          </Badge>
          <Badge tone="good">live</Badge>
        </div>
      </div>

      <dl className="mt-3 divide-y divide-border border-t border-border">
        <Field label="Endpoint we call" mono>
          <span className="break-all text-fg">{CATALOG_ENDPOINT}</span>
        </Field>
        <Field label="Method">
          <span className="font-mono text-fg">GET</span>
        </Field>
        <Field label="Auth">
          Not required. No key is sent and none is needed.
        </Field>
        <Field label="Freshness">
          Fetched once every{" "}
          <span className="font-mono tabular-nums text-fg">
            {CATALOG_TTL_SECONDS / 60}
          </span>{" "}
          minutes and shared by every visitor, so a public deployment does not
          call OpenRouter once per page view. The catalog page prints the moment
          of the real fetch, not of the cache read.
        </Field>
        <Field label="Licence">
          Unstated on the endpoint. Treat the figures as OpenRouter&rsquo;s, and
          attribute them.
        </Field>
        <Field label="What is hand-maintained" mono>
          <span className="text-fg">data/model-id-map.json</span>
          <span className="text-fg-subtle"> · </span>
          <span className="text-fg">data/models-supplement.json</span>
        </Field>
      </dl>

      <div className="mt-3 space-y-2">
        <Callout label="This is not the vendor speaking" tone="warn">
          Four fields on /models look like vendor facts and are not.{" "}
          <span className="text-fg">The date</span> is when OpenRouter listed
          the model, not when the vendor announced it — they differ by days.{" "}
          <span className="text-fg">The price</span> is what OpenRouter charges
          to route the model, which need not match the vendor&rsquo;s list
          price. <span className="text-fg">Open weights</span> is inferred from
          the presence of a HuggingFace id on the listing, which is a reasonable
          signal and not a licence check.{" "}
          <span className="text-fg">Lifecycle status</span> is not published at
          all, so almost every model reads{" "}
          <span className="font-mono">unclassified</span>; the sole exception is
          a real future <span className="font-mono">expiration_date</span>,
          which we render as deprecated. Sentinel values are discarded — several
          z-ai rows carry <span className="font-mono">2098-12-31</span> to mean
          &ldquo;no expiry&rdquo;.
        </Callout>
        <Callout label="What replacing the curated catalog cost" tone="warn">
          The old catalog was 45 models typed by hand, each with an editorial{" "}
          <span className="font-mono">status</span> (flagship / current /
          preview / legacy / deprecated) and a prose{" "}
          <span className="font-mono">note</span>. Neither exists in the API, so
          both are gone: there is no flagship view on this site any more, and
          the price-caveat marker that those notes drove was removed rather than
          left as a marker that never fires. What was gained is a catalog that
          changes when the world does, and several hundred models instead of 45.
        </Callout>
        <Callout label="Ids are mapped, not renamed" tone="neutral">
          The catalog is keyed by OpenRouter slugs now, but{" "}
          <span className="font-mono text-fg">data/benchmarks.json</span> holds
          scores and leaderboard rows keyed by the{" "}
          <span className="font-mono tabular-nums text-fg">
            {getIdMapSize()}
          </span>{" "}
          former curated ids, and eight live fetchers resolve board names
          against the same table. Those joins survive because{" "}
          <span className="font-mono text-fg">data/model-id-map.json</span>{" "}
          carries every old id and name forward as an alias. It was generated
          once by matching the old catalog against this endpoint and reviewed by
          hand; deleting a row from it silently empties part of /benchmarks.
        </Callout>
        <Callout label="Five models OpenRouter does not carry" tone="warn">
          {SUPPLEMENT_MODELS.length} models are restricted-access or retired and
          have no OpenRouter listing:{" "}
          <span className="text-fg">
            {SUPPLEMENT_MODELS.map((m) => m.name).join(", ")}
          </span>
          . Dropping them would have deleted Google&rsquo;s flagship reasoning
          model from the site entirely, so they are kept in{" "}
          <span className="font-mono text-fg">data/models-supplement.json</span>{" "}
          and marked <Badge tone="warn">manual</Badge> wherever they appear.
          Nothing refreshes them, and they carry no status they did not earn
          from a recorded retirement date.
        </Callout>
      </div>
    </Card>
  );
}

export function CuratedDataEntry() {
  return (
    <Card id="curated" className="scroll-mt-20 border-warn/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-fg">
            Benchmark scores
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-muted">
            The comparison matrix and the two static leaderboards on{" "}
            <Link href="/benchmarks" className="text-accent hover:underline">
              /benchmarks
            </Link>
            . The model names beside them come from the live catalog above; the
            numbers do not.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="warn">
            <span className="font-mono">hand-curated</span>
          </Badge>
          <Badge tone="bad">not live</Badge>
        </div>
      </div>

      <dl className="mt-3 divide-y divide-border border-t border-border">
        <Field label="Endpoint we call">
          <span className="text-warn">
            None. Nothing is fetched — there is no request behind these numbers.
          </span>
        </Field>
        <Field label="Where it lives" mono>
          <span className="text-fg">data/benchmarks.json</span>
        </Field>
        <Field label="Captured">
          <span className="font-mono tabular-nums text-fg">
            {formatDate(CURATED_CAPTURED_AT)}
          </span>
          <span className="text-fg-subtle">
            {" "}
            — and unchanged since, unless someone has edited the files.
          </span>
        </Field>
        <Field label="Cadence">
          Whenever a person edits the JSON and rebuilds. There is no schedule
          and no automation.
        </Field>
      </dl>

      <div className="mt-3 space-y-2">
        <Callout label="Read this before quoting a number" tone="bad">
          This file is transcribed by hand and committed to the repository. It
          is a snapshot, not a feed, and it goes stale silently: nothing on that
          page will tell you a score was revised yesterday. Do not assume any
          figure there is current — check the source before you rely on it. The
          model catalog beside it <span className="text-fg">is</span> fetched
          live, which makes the contrast easy to miss; the scores are the half
          that is typed.
        </Callout>
        <Callout label="Why there is no API" tone="warn">
          No public API publishes benchmark scores. Vendors put their benchmark
          tables in launch-post images, or behind pages that refuse automated
          fetching, and they revise them without notice. Hand transcription is
          the honest option available; pretending it is a feed would not be.
          Model <span className="text-fg">specifications</span> were in the same
          position until OpenRouter&rsquo;s catalog replaced them — which is why
          the entry above exists and this one still does not.
        </Callout>
      </div>
    </Card>
  );
}
