# tech/trends

A small, dense dashboard for keeping track of what actually shipped in AI and
open source: which models exist, when they landed, what they cost, how they
score on public benchmarks, and what developers are starring on GitHub right
now.

Built with Next.js 16 (App Router), React 19, TypeScript and Tailwind v4.
Dark theme only. Every page is a server component; the only client component is
the navigation.

## Routes

| Route         | What it shows                                                                 |
| ------------- | ----------------------------------------------------------------------------- |
| `/`           | Overview — headline counts, latest releases, current flagships, teasers        |
| `/models`     | Full model catalog: dense filterable table plus family lineage                 |
| `/benchmarks` | Leaderboards and a model × benchmark comparison matrix                         |
| `/leaderboards` | All eight external leaderboards, fetched live, grouped by source, each with its health |
| `/github`     | GitHub trending repositories, fetched live                                     |
| `/sources`    | Reference: where every number comes from, the exact endpoint, and what to distrust |

## Data sources, and what is wrong with each of them

This dashboard mixes two very different kinds of data, and it is worth being
blunt about the difference.

**1. The model catalog — fetched live from OpenRouter.**
Release dates, context windows, max output tokens, pricing and modality come
from `https://openrouter.ai/api/v1/models`, cached for an hour. New models
appear on their own. Limitations, all surfaced in the UI:

- The date is OpenRouter's **listing** date, not the vendor's announcement.
- The price is OpenRouter's price to route the model, not the vendor's list
  price.
- `openWeights` is **inferred** from the presence of a HuggingFace id, not
  read off a licence.
- Lifecycle status is mostly unavailable: only a real `expiration_date`
  yields a deprecation signal, and everything else reads `unclassified`.
  Nothing here guesses which model is a vendor's flagship.
- Five restricted-access models OpenRouter does not carry are recorded by
  hand in `data/models-supplement.json` and marked as manual in the UI.
- `data/model-id-map.json` pins the 40 old curated ids to their OpenRouter
  equivalents so the benchmark scores keep joining. Do not delete entries
  from it casually.
- Pricing is list price for the standard tier. Batch discounts, cached-input
  rates, long-context surcharges and enterprise pricing are not modelled.
- `status` (`flagship` / `current` / `preview` / `legacy` / `deprecated`) is an
  editorial judgement, not something vendors publish in a consistent form.
- Anything not published is `null` and renders as an em dash. The UI never
  guesses a missing value.

**2. `data/benchmarks.json` — curated by hand, and doubly suspect.**
Benchmark scores and leaderboard standings. Limitations:

- Most published scores are **vendor-reported**: measured by the company
  selling the model, often with bespoke prompting and scaffolding. These are
  marked with a distinct dot in the matrix and are *not* directly comparable to
  independent runs. The legend on `/benchmarks` explains the marking.
- Leaderboard bars are normalised **within** a single leaderboard. Elo-style
  ratings have no meaningful zero, so scales are not comparable across boards.
- Benchmarks saturate and leak into training data. A high MMLU number in 2026
  means much less than it did in 2023.
- Scores go stale within weeks. `updatedAt` and the source links are shown
  prominently on the page for exactly this reason.

**3. GitHub trending — live API.**
Fetched from the GitHub API at request time, so it is genuinely current, but it
is subject to rate limits and to whatever ranking the search API applies.
Star counts are a popularity signal, not a quality signal.

**4. External leaderboards — fetched live, one source at a time.**
Eight public boards, pulled at request time and rendered on `/leaderboards`.
Each one is registered in [`src/lib/sources.ts`](src/lib/sources.ts) with its
endpoint, licence, cadence, credibility and conflicts of interest, and each
fetch reports its own health. Limitations are per-source and documented on
`/sources`; the short version is that half of them are scraped rather than
called, and a scraped board can stop updating without anyone being told.

## `/leaderboards` and `/sources`

These two pages are a pair. `/leaderboards` shows the numbers; `/sources`
explains where each one came from and how much it can carry.

### The source registry

[`src/lib/sources.ts`](src/lib/sources.ts) is the single description of every
leaderboard the site pulls. It is content, not configuration — `/sources`
renders it directly, so adding an entry there is what makes a source appear on
the site. Every entry carries:

| Field | Why it is there |
| ----- | --------------- |
| `endpoint`, `method` | The exact address we call, printed verbatim on `/sources` |
| `fetchKind` | `json-api` / `static-json` / `csv` are published interfaces; `scrape-embedded-json` / `scrape-html` are us reading a page built for humans |
| `requiresAuth`, `license` | Whether a clean checkout can fetch it, and on what terms |
| `measures`, `unit` | What the score column actually means — Elo, % solved, tokens, ECI |
| `credibility`, `credibilityNote` | `high` / `medium` / `caveated`, plus the case against the board |
| `conflictOfInterest` | A stake the operator has in its own ranking. Rendered **on the board itself**, not behind a link |
| `cadence` | How often the upstream board changes, which is not how often we fetch it |

`isFragile(source)` is the `fetchKind.startsWith("scrape")` test. Fragile
sources are marked on both pages, because their failure mode is silence: a
redesign upstream and the numbers either stop arriving or quietly stop
changing.

### Health: live, stale, unavailable

Every fetch returns a `LeaderboardResult` carrying a `SourceHealth`, and the UI
never renders a board without it:

- **live** — fetched successfully for this page load.
- **stale** — the live fetch failed, so the board falls back to
  `data/leaderboards-snapshot.json`. The board is drawn differently (dashed
  border, muted bars, a `snapshot` tag) and states the date the snapshot was
  captured together with the error that caused the fallback.
- **unavailable** — the fetch failed and no snapshot exists. Nothing is
  shown. An empty space is the honest output; old numbers dressed up as current
  ones are not.

`upstreamUpdatedAt` (when the board itself last changed) and `retrievedAt`
(when we fetched it) are shown as separate facts. A board can be fetched
successfully a minute ago and still be months out of date, and several are.

### Reading the boards

- Bars are normalised **within a single board**. The units across boards are
  Elo, % solved, % resolved, tokens processed and a latent-variable index;
  nothing about them is comparable, and no combined ranking is offered.
- Where a board publishes a confidence interval it is drawn on the bar, and
  rows whose intervals overlap a neighbour are marked with `*`. Those rows are
  statistically tied — the rank number between them is an artefact of sorting.
- Where a board reports cost per task it gets its own column, because on
  ARC-AGI-3 a top score costs five figures per task and a score without that
  is half the result.
- A model name links into `/models` only when it resolved to a model in the
  catalog. Unresolved names are printed exactly as the board gave them.
- `?source=<id>` filters to one source; every filtered view is a shareable URL.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint
npx tsc --noEmit

npm run refresh-data   # refresh the committed leaderboard fallback snapshot
```

## Updating the data

The two curated datasets live in `data/` and conform exactly to the interfaces
in [`src/lib/types.ts`](src/lib/types.ts) — `Model[]` and `BenchmarkData`.
That file is the contract; edit it first if the shape needs to change.

1. Edit `data/benchmarks.json` (scores), `data/models-supplement.json` (the
   five models OpenRouter does not list), or `data/model-id-map.json` (the
   id pins that keep scores joined). The main catalog is live and is not
   edited by hand.
2. Bump `updatedAt` in `data/benchmarks.json` when you touch scores.
3. Run `npx tsc --noEmit` — the accessors in `src/lib/models.ts` and
   `src/lib/benchmarks.ts` type the JSON on the way in.
4. Reload. Both files are imported at build time, so a production deploy needs
   a rebuild to pick up changes.

`data/leaderboards-snapshot.json` is the third curated file: a map of source id
to last-known-good boards, each with its own `capturedAt`. It is what a
**stale** board on `/leaderboards` falls back to, and the page always says how
old a snapshot is rather than passing it off as live. An empty object `{}` is
valid — every source then degrades to **unavailable** instead of **stale**.

That third file is the one thing here that can refresh itself: see
[Keeping the data fresh](#keeping-the-data-fresh) for `npm run refresh-data`
and the daily schedule. The other two can only ever be updated by a person.

The accessors are deliberately defensive: a score that references an unknown
`modelId` or `benchmarkId` is dropped rather than rendered, and malformed rows
are skipped instead of crashing the page. Prefer fixing the JSON over relying on
that.

## Keeping the data fresh

Different things here go stale on different clocks, and they are easy to
confuse. They are not the same thing and they are not fixed the same way.

| What | Refreshed by | How often | Needs a human? |
| --- | --- | --- | --- |
| Leaderboard numbers on `/leaderboards` | The app itself | Every hour | No |
| The model catalog on `/models` | The app itself | Every hour | No |
| `data/leaderboards-snapshot.json` — the committed **fallback** boards | `npm run refresh-data` | Daily, if scheduled | No |
| `data/benchmarks.json` — curated scores | Nothing. Only a person. | — | **Yes** |
| `data/model-id-map.json`, `data/models-supplement.json` — hand-curated corrections over the live catalog | Nothing. Only a person. | — | **Yes** |

Only the third row is what `npm run refresh-data` and the scheduled job below
are about.

**The scheduled job does not refresh what visitors see.** Every page fetches
its sources live and Next revalidates that collection hourly on its own
(`LEADERBOARD_TTL_SECONDS` in `src/lib/leaderboards.ts`). Nothing needs to run
for the site to show current numbers. What the schedule refreshes is the
*fallback* — the copy the page serves, clearly labelled **stale** with its
capture date, on the days a live fetch fails. Four of the eight sources are
HTML/RSC scrapers that will break when their site is redesigned; on that day
the snapshot is all the page has, and a snapshot frozen months in the past is
barely better than nothing.

### `npm run refresh-data`

```bash
npm run refresh-data                # fetch all 8 sources, rewrite the snapshot
npm run refresh-data -- --dry-run   # report only, write nothing
npm run refresh-data -- --strict    # also fail on warnings (see below)
npm run refresh-data -- --help
```

It fetches all eight sources live — the app's hourly cache is deliberately
bypassed, since being served an hour-old collection would defeat the point —
prints a per-source report, and rewrites `data/leaderboards-snapshot.json`.

**The rule it enforces:** a source's snapshot entry is replaced *only* when
that source came back `health: "live"` **and** actually returned entries.
Anything else — a fetch that failed, a scraper whose selectors stopped matching
and returned zero rows, data that fails the shape check — leaves that source's
existing entry untouched. Overwriting a broken scraper's snapshot with the
empty boards it just produced would destroy the only fallback the page has, at
exactly the moment it is needed. Partial success is success for the file: the
sources that worked are written even when others failed.

The write itself goes to a temp file and is renamed over the target, so the
snapshot is never left half-written; the assembled JSON is shape-checked and
re-parsed first, and an unchanged result is not rewritten at all.

One case sits between success and failure and is reported rather than blocked:
a source that comes back live but **smaller** than the snapshot it is replacing
— one page of a multi-page scrape 404s, say. That is still live data and
refusing it forever would freeze the snapshot, so it is written; but it quietly
shrinks the fallback, so the run names the source and the before/after counts
instead of leaving it to be noticed in a diff.

It also reports the age of `data/benchmarks.json` and complains loudly past 30
days. It cannot fix that file — those scores are transcribed by hand from
vendor model cards and papers, and no API publishes them — so all it can do is
make the staleness impossible to miss.

Exit codes, so a scheduler can tell routine breakage from an outage:

| Code | Meaning |
| --- | --- |
| `0` | Every source live. |
| `1` | Degraded — some source failed. The snapshot **was still updated** for the ones that worked, and the failures kept their previous entry. With `--strict`, warnings (a stale `benchmarks.json`, a source that shrank) also land here. |
| `2` | Fatal — nothing was written. The build failed, or not one source returned usable data. |

A source that shows up in the failure list on consecutive days has a genuinely
broken fetcher in `src/lib/fetchers/` and needs fixing by hand.

<details>
<summary>How it runs the app's TypeScript outside Next</summary>

`src/lib/leaderboards.ts` and `src/lib/fetchers/designarena.ts` import
`unstable_cache` from `next/cache`, which does not resolve outside a Next
runtime, and every import uses the `@/` alias, which only a bundler honours.
So `scripts/refresh-data.mjs`:

1. compiles `src/lib/leaderboards.ts` and its import graph to CommonJS in a
   throwaway temp directory, using the `typescript` devDependency already in
   the project (`scripts/tsconfig.refresh.json`);
2. hooks Node's module resolver to point `next/cache` at
   `scripts/next-cache.cjs` — a pass-through that implements no caching, which
   is also how the hourly cache gets bypassed — and to rewrite `@/x` to the
   compiled `src/x`;
3. calls `fetchAllLeaderboards()`, the same entry point the pages use.

Nothing is written into the repository and the temp directory is removed
afterwards. The runner is `.mjs` rather than `.ts` on purpose: this project
runs on Node 20, which cannot execute TypeScript, and carries no `ts-node` or
`tsx` — adding a TypeScript runtime just to run one maintenance script would be
a dependency the app does not otherwise need, and would put a build step in
front of the very thing meant to be runnable from cron.

Because it goes through `fetchAllLeaderboards()` rather than reaching into any
fetcher's internals, it is insulated from changes to the model catalog. If the
compile step fails, the script says so and stops; it never edits `src/`.
</details>

### Enabling the schedule

Daily, either way. The snapshot is a safety net, so it needs to be *recent*,
not *current* — currency is the live path's job. Daily bounds how old the
fallback can ever be at 24 hours, which is inside every upstream's own
publishing cadence, and costs at most one commit a day. Hourly would mean 24
commits a day of churn and 24× the traffic to eight third-party sites for a
file that is only read once something has already gone wrong; weekly would let
the fallback drift a week behind, which is the rot this exists to stop.

**On GitHub** — [`.github/workflows/refresh-data.yml`](.github/workflows/refresh-data.yml)
runs at 05:27 UTC daily (and on demand via **Actions → Run workflow**), commits
`data/leaderboards-snapshot.json` back only when it actually changed, and needs
no configuration beyond `contents: write`, which it declares. A failed scraper
raises a warning annotation and a job summary rather than a red X — a job that
goes red every morning is a job everyone learns to ignore — while a total
outage (exit `2`) does fail the run.

> **This repository has no git remote yet, so nothing in Actions can run.** Push
> it to GitHub and the workflow starts on its own; until then, use the local
> schedule below.

**Locally, with no remote** — [`scripts/com.tech-trends.refresh-data.plist`](scripts/com.tech-trends.refresh-data.plist)
is a launchd template. It is *not* installed. To enable it, run:

```bash
# from the repository root
mkdir -p ~/Library/LaunchAgents
sed -e "s|__NODE__|$(command -v node)|" \
    -e "s|__REPO__|$PWD|g" \
    -e "s|__HOME__|$HOME|" \
    scripts/com.tech-trends.refresh-data.plist \
    > ~/Library/LaunchAgents/com.tech-trends.refresh-data.plist

launchctl bootstrap gui/"$(id -u)" ~/Library/LaunchAgents/com.tech-trends.refresh-data.plist
```

That runs the refresh at 05:27 local time each day (launchd fires it on the
next wake if the machine was asleep) and appends the full report to
`~/Library/Logs/tech-trends-refresh-data.log`. Unlike the GitHub workflow it
does **not** commit — it leaves the refreshed snapshot as an uncommitted change
for you to review, because a background job that writes to your git history
unasked is not something to install on a laptop.

To check on it, disable it, or remove it:

```bash
launchctl print gui/"$(id -u)"/com.tech-trends.refresh-data   # status, exit code, next run
tail -f ~/Library/Logs/tech-trends-refresh-data.log           # the per-source report
launchctl kickstart gui/"$(id -u)"/com.tech-trends.refresh-data  # run it now, once

launchctl bootout gui/"$(id -u)"/com.tech-trends.refresh-data
rm ~/Library/LaunchAgents/com.tech-trends.refresh-data.plist
```

(On macOS versions old enough to predate `bootstrap`/`bootout`, the equivalents
are `launchctl load` and `launchctl unload` on the plist path.)

If you would rather use cron, this is the same schedule as one line in
`crontab -e` — note the absolute paths, since cron gets almost no environment:

```cron
27 5 * * * cd /absolute/path/to/tech-trends && /absolute/path/to/node scripts/refresh-data.mjs >> "$HOME/Library/Logs/tech-trends-refresh-data.log" 2>&1
```

## `GITHUB_TOKEN`

The `/github` route calls the GitHub API. Unauthenticated requests are limited
to 60 requests per hour per IP, which is not enough for anything but local
poking. Set a token to raise the limit to 5,000/hour:

```bash
cp .env.example .env.local
# then edit .env.local
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

A classic token with **no scopes at all** is sufficient — the route only reads
public repository data. Never commit `.env.local`. On Vercel, add `GITHUB_TOKEN`
as an environment variable in the project settings instead.

## Deploying to Vercel

The project is a stock Next.js app with no custom server and no runtime
dependencies beyond the framework, so it deploys as-is:

1. Push the repository to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new). The framework preset,
   build command (`next build`) and output directory are detected automatically.
3. Add `GITHUB_TOKEN` under **Settings → Environment Variables** for the
   Production, Preview and Development environments.
4. Deploy.

Because `data/*.json` is imported at build time, refreshing the curated data
means committing the change and letting Vercel rebuild.

## Project layout

```
data/                       curated JSON (models, benchmarks) + leaderboard snapshot
scripts/refresh-data.mjs    refreshes data/leaderboards-snapshot.json (see "Keeping the data fresh")
scripts/*.plist, *.cjs      launchd template + the next/cache stub the script runs the fetchers with
.github/workflows/          the daily snapshot refresh
src/app/                    routes: /, /models, /benchmarks, /leaderboards, /github, /sources
src/components/ui/          shared primitives: Card, SectionHeader, Badge, Stat, Empty, Callout
src/components/models/      catalog table, filters, cards, lineage
src/components/benchmarks/  leaderboard cards, score matrix
src/components/leaderboards/source groups, board cards, health notes, source filter
src/components/sources/     source reference entries, fetch-kind and credibility badges
src/components/Nav.tsx      sticky top nav (the only client component)
src/lib/types.ts            the shared data contract
src/lib/format.ts           formatCompact / formatTokens / formatUSD / formatDate / relativeTime
src/lib/models.ts           typed, sorted, grouped accessors over models.json
src/lib/benchmarks.ts       typed accessors, matrix builder, heat normalisation
src/lib/sources.ts          the leaderboard source registry (rendered by /sources)
src/lib/leaderboards.ts     fetches every source in parallel, guarded per source
src/lib/fetchers/           one fetcher per source
src/lib/snapshot.ts         committed last-known-good boards, the stale fallback
```
