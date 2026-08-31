#!/usr/bin/env node
/**
 * Refreshes the committed fallback data in `data/`.
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * It does not refresh what visitors see. The pages fetch every leaderboard
 * live and Next re-fetches them hourly on its own. This script exists for the
 * one file that cannot heal itself: `data/leaderboards-snapshot.json`, the
 * last-known-good copy the app serves (labelled "stale", with its capture
 * date) whenever a live fetch fails. Four of the eight sources are HTML/RSC
 * scrapers that will break on an upstream redesign; when that happens the
 * snapshot is all the page has left, so it must not be allowed to rot.
 *
 * THE RULE THIS FILE ENFORCES
 * ---------------------------
 * A source's snapshot entry is replaced ONLY when that source came back
 * `health: "live"` with actual entries. A source that failed keeps its
 * existing entry, byte for byte. Overwriting a broken scraper's snapshot with
 * the empty boards it just returned would destroy the only fallback the page
 * has, precisely at the moment it needs it.
 *
 * WHY .mjs AND NOT .ts
 * --------------------
 * This project runs on Node 20, which cannot execute TypeScript, and carries
 * no `ts-node`/`tsx` dependency. Adding a TypeScript runtime just to run one
 * maintenance script is a dependency the app does not otherwise need, and it
 * would put a build step in front of the very script meant to be trivially
 * runnable from cron. So the runner is plain ESM — `node scripts/refresh-
 * data.mjs` works with nothing installed but the app's own dependencies — and
 * it uses the `typescript` devDependency that is already here to compile the
 * app's modules, which genuinely do need compiling.
 *
 * RUNNING THE APP'S MODULES OUTSIDE NEXT
 * --------------------------------------
 * Two things stand in the way, both handled below:
 *   1. `src/lib/leaderboards.ts` and `src/lib/fetchers/designarena.ts` import
 *      `unstable_cache` from `next/cache`, which does not resolve outside a
 *      Next runtime. A resolver hook points it at `scripts/next-cache.cjs`,
 *      a pass-through — which also means every run really hits the network
 *      instead of being served an hour-old cached collection.
 *   2. Imports use the `@/` alias, which nothing outside a bundler honours.
 *      The same hook rewrites `@/x` to the compiled `src/x`.
 *
 * Usage: node scripts/refresh-data.mjs [--strict] [--dry-run]
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ------------------------------------------------------------------ config */

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
/** Derived from this file, never from cwd, so cron and launchd can call it. */
const REPO = path.resolve(SCRIPT_DIR, "..");

const SNAPSHOT_FILE = path.join(REPO, "data", "leaderboards-snapshot.json");
const BENCHMARKS_FILE = path.join(REPO, "data", "benchmarks.json");
const TSCONFIG = path.join(SCRIPT_DIR, "tsconfig.refresh.json");
const NEXT_CACHE_STUB = path.join(SCRIPT_DIR, "next-cache.cjs");
const TSC_BIN = path.join(REPO, "node_modules", "typescript", "bin", "tsc");

/**
 * `data/benchmarks.json` is hand-curated from vendor model cards and papers.
 * There is no API for it and this script cannot refresh it — it can only say
 * how old it is. A month is roughly one model-release cycle: past that, the
 * headline scores on the benchmarks page are likely missing a flagship.
 */
const BENCHMARK_MAX_AGE_DAYS = 30;

/** A hung upstream must not leave a scheduled job running forever. */
const FETCH_TIMEOUT_MS = 180_000;

/**
 * Exit codes, chosen so a scheduler can tell "one scraper broke" (routine,
 * worth a warning) from "we got nothing" (worth waking someone).
 */
const EXIT_OK = 0;
const EXIT_DEGRADED = 1;
const EXIT_FATAL = 2;

/* ------------------------------------------------------------------- flags */

const USAGE = `Refresh the committed leaderboard fallback snapshot.

  node scripts/refresh-data.mjs [options]
  npm run refresh-data -- [options]

Options
  --dry-run   Fetch and report, but do not write any file.
  --strict    Also exit non-zero on warnings: data/benchmarks.json older than
              ${BENCHMARK_MAX_AGE_DAYS} days, or a live source that came back smaller than the
              snapshot it replaced. Off by default - neither is something a
              scheduled job can fix, and failing nightly on them is noise.
  --help      Show this.

Exit codes
  0  every source live, nothing to warn about
  1  degraded - some source failed; the snapshot was still updated for the
     sources that succeeded, and failed sources kept their previous entry
  2  fatal - nothing could be written (build failure, or no source succeeded)
`;

function parseArgs(argv) {
  const opts = { strict: false, dryRun: false };
  for (const arg of argv) {
    if (arg === "--strict") opts.strict = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      process.stdout.write(USAGE);
      process.exit(EXIT_OK);
    } else {
      fail(`Unknown option: ${arg}\n\n${USAGE}`);
    }
  }
  return opts;
}

/* ------------------------------------------------------------------ output */

const out = (line = "") => process.stdout.write(`${line}\n`);

function fail(message) {
  process.stderr.write(`\nFATAL  ${message}\n`);
  process.exit(EXIT_FATAL);
}

function pad(value, width) {
  return String(value).padEnd(width);
}

function padStart(value, width) {
  return String(value).padStart(width);
}

/* ------------------------------------------------------- compile + require */

/**
 * Compiles `src/lib/leaderboards.ts` and its import graph to CommonJS in a
 * throwaway directory. Nothing is written into the repo, so this is safe to
 * run concurrently with anything else and leaves no build artefact to ignore.
 */
function compileAppModules(buildDir) {
  if (!fs.existsSync(TSC_BIN)) {
    fail(
      `TypeScript not found at ${TSC_BIN}.\n` +
        `       Run \`npm install\` in ${REPO} first.`,
    );
  }

  const started = Date.now();
  const result = spawnSync(
    process.execPath,
    [TSC_BIN, "--project", TSCONFIG, "--outDir", buildDir],
    { cwd: REPO, encoding: "utf8" },
  );

  if (result.error) fail(`Could not run tsc: ${result.error.message}`);

  if (result.status !== 0) {
    const diagnostics = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    fail(
      "The app's TypeScript does not compile, so the fetchers could not be " +
        "run.\n\n" +
        `${diagnostics}\n\n` +
        "       This script only reads the app; it does not modify it. Fix " +
        "the errors above\n" +
        "       in src/ and re-run. If they are in src/lib/models.ts or " +
        "src/lib/model-match.ts,\n" +
        "       the model catalog changed shape underneath the leaderboard " +
        "fetchers.",
    );
  }

  return Date.now() - started;
}

/**
 * Teaches Node's CommonJS resolver the two things the app assumes and a bare
 * Node process does not: that `next/cache` exists, and that `@/` means `src/`.
 */
function installResolverHook(buildDir) {
  const compiledSrc = path.join(buildDir, "src");
  const originalResolve = Module._resolveFilename;
  // Resolves bare package names as if from the repository root.
  const fromRepo = Module.createRequire(path.join(REPO, "package.json"));

  Module._resolveFilename = function patched(request, ...rest) {
    // 1. next/cache -> the pass-through stub (see scripts/next-cache.cjs).
    if (request === "next/cache") return NEXT_CACHE_STUB;

    // 2. The `@/` alias -> the compiled src tree.
    if (request.startsWith("@/")) {
      return originalResolve.call(
        this,
        path.join(compiledSrc, request.slice(2)),
        ...rest,
      );
    }

    // 3. Bare package names -> the repository's node_modules.
    //
    // The compiled code lives in a temp directory outside the repository, so
    // Node's own upward walk for node_modules starts in the wrong place and
    // finds nothing. Anything the app's lib layer imports from a package —
    // `react`'s `cache()`, for instance — would fail with "Cannot find module"
    // even though the dependency is installed. Resolving from the repo root
    // makes the temp build behave like code sitting inside the project.
    if (!request.startsWith(".") && !path.isAbsolute(request)) {
      try {
        return fromRepo.resolve(request);
      } catch {
        // Genuinely missing, or a builtin — let the normal resolver report it.
      }
    }

    return originalResolve.call(this, request, ...rest);
  };

  return compiledSrc;
}

/* ----------------------------------------------------------- snapshot i/o */

function readJson(file, label) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (cause) {
    fail(`Could not read ${label}: ${cause.message}`);
  }
  try {
    return { text, value: JSON.parse(text) };
  } catch (cause) {
    fail(`${label} is not valid JSON: ${cause.message}`);
  }
}

/**
 * A shape check, run against every entry before anything is written — the
 * committed snapshot is the app's last line of defence, and a malformed one
 * would take the leaderboards page down rather than degrade it. Returns a
 * reason string when the entry is unusable, or null when it is fine.
 */
function validateEntry(entry) {
  if (!entry || typeof entry !== "object") return "not an object";
  if (typeof entry.capturedAt !== "string") return "capturedAt is not a string";
  if (entry.upstreamUpdatedAt !== null && typeof entry.upstreamUpdatedAt !== "string") {
    return "upstreamUpdatedAt is neither a string nor null";
  }
  if (!Array.isArray(entry.boards)) return "boards is not an array";

  for (const [i, board] of entry.boards.entries()) {
    const at = `boards[${i}]`;
    if (!board || typeof board !== "object") return `${at} is not an object`;
    for (const key of ["id", "name", "url", "updatedAt"]) {
      if (typeof board[key] !== "string") return `${at}.${key} is not a string`;
    }
    if (!Array.isArray(board.entries)) return `${at}.entries is not an array`;
    for (const [j, row] of board.entries.entries()) {
      const rowAt = `${at}.entries[${j}]`;
      if (!row || typeof row !== "object") return `${rowAt} is not an object`;
      if (!Number.isFinite(row.rank)) return `${rowAt}.rank is not a number`;
      if (typeof row.modelName !== "string") return `${rowAt}.modelName is not a string`;
      if (!Number.isFinite(row.score)) return `${rowAt}.score is not a number`;
    }
  }
  return null;
}

function countEntries(boards) {
  return boards.reduce((total, board) => total + board.entries.length, 0);
}

/** Serialise exactly as the file is already formatted, so diffs stay honest. */
function serialize(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/**
 * Replaces the file in one step. A half-written snapshot is worse than a stale
 * one — the app imports this file at build time, and a truncated JSON would
 * fail the build rather than degrade the page — so the new content lands in a
 * sibling temp file first and is then renamed over the target, which is atomic
 * within a filesystem.
 */
function writeAtomic(file, contents) {
  const temp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.tmp`,
  );
  try {
    fs.writeFileSync(temp, contents, "utf8");
    fs.renameSync(temp, file);
  } catch (cause) {
    fs.rmSync(temp, { force: true });
    fail(`Could not write ${file}: ${cause.message}`);
  }
}

/* ---------------------------------------------------------------- reporting */

function daysSince(dateText) {
  const parsed = Date.parse(dateText);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / 86_400_000);
}

function shortTimestamp(value) {
  if (typeof value !== "string") return "-";
  return value.length > 20 ? `${value.slice(0, 19)}Z` : value;
}

/* --------------------------------------------------------------------- main */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const startedAt = new Date();

  out("tech-trends · refresh-data");
  out(`  repo     ${REPO}`);
  out(`  started  ${startedAt.toISOString()}`);
  out(`  target   data/leaderboards-snapshot.json (the committed fallback,`);
  out("           not the live page data - that refreshes hourly by itself)");
  if (opts.dryRun) out("  mode     --dry-run: nothing will be written");
  if (opts.strict) out("  mode     --strict: stale benchmarks fail the run");
  out();

  // Read the existing snapshot before anything else: it is both the thing we
  // merge into and the thing we must not damage.
  const existing = readJson(SNAPSHOT_FILE, "data/leaderboards-snapshot.json");
  if (!existing.value || typeof existing.value !== "object" || Array.isArray(existing.value)) {
    fail("data/leaderboards-snapshot.json is not a JSON object.");
  }

  const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "tech-trends-refresh-"));
  let results;
  try {
    const compileMs = compileAppModules(buildDir);
    out(`Compiled the app's fetchers for out-of-Next execution (${compileMs} ms).`);

    const compiledSrc = installResolverHook(buildDir);
    const require = Module.createRequire(import.meta.url);
    const { fetchAllLeaderboards } = require(
      path.join(compiledSrc, "lib", "leaderboards.js"),
    );

    out("Fetching every source live (the app's 1-hour cache is bypassed) ...");
    out();

    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`No response after ${FETCH_TIMEOUT_MS / 1000}s`)),
        FETCH_TIMEOUT_MS,
      );
    });
    try {
      results = await Promise.race([fetchAllLeaderboards(), timeout]);
    } catch (cause) {
      fail(`Fetching leaderboards did not finish: ${cause.message}`);
    } finally {
      clearTimeout(timer);
    }
  } finally {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }

  /* ---- merge: live sources replace their entry, everything else keeps it -- */

  const capturedAt = new Date().toISOString();
  const merged = {};
  const rows = [];
  const failures = [];
  const shrunk = [];

  for (const result of results) {
    const { sourceId } = result;
    const previous = existing.value[sourceId] ?? null;
    const entries = countEntries(result.boards ?? []);

    // "live" alone is not enough. A scraper whose selectors stopped matching
    // can succeed at fetching and still yield nothing; writing that would be
    // the exact data loss this script exists to prevent.
    const usable =
      result.health === "live" && (result.boards?.length ?? 0) > 0 && entries > 0;

    let action;
    if (usable) {
      const candidate = {
        boards: result.boards,
        upstreamUpdatedAt: result.upstreamUpdatedAt ?? null,
        capturedAt,
      };
      const problem = validateEntry(candidate);
      if (problem) {
        // Refuse the new data rather than commit something malformed.
        if (previous) merged[sourceId] = previous;
        action = previous ? "kept" : "missing";
        failures.push({
          sourceId,
          message: `Live data failed the shape check (${problem}); previous entry kept.`,
        });
      } else {
        merged[sourceId] = candidate;
        action = previous ? "updated" : "added";

        // A source can succeed and still come back with less than last time —
        // one of a multi-page scrape 404s, a board is dropped upstream. That
        // is accepted (it is live data, and refusing it forever would wedge
        // the snapshot), but it quietly shrinks the fallback, so it is called
        // out rather than buried in a diff.
        if (previous) {
          const wasBoards = previous.boards?.length ?? 0;
          const wasEntries = countEntries(previous.boards ?? []);
          if (result.boards.length < wasBoards || entries < wasEntries) {
            shrunk.push({
              sourceId,
              message:
                `${wasBoards} board(s)/${wasEntries} entries -> ` +
                `${result.boards.length}/${entries}.`,
            });
          }
        }
      }
    } else {
      if (previous) merged[sourceId] = previous;
      action = previous ? "kept" : "missing";
      failures.push({
        sourceId,
        message:
          result.health === "live"
            ? "Reported live but returned no entries."
            : (result.error ?? "no error reported"),
      });
    }

    rows.push({
      sourceId,
      health: result.health,
      boards: result.boards?.length ?? 0,
      entries,
      upstream: shortTimestamp(result.upstreamUpdatedAt),
      action,
    });
  }

  // Sources present in the file but no longer produced by any fetcher are
  // carried through untouched. Silently dropping them would be a deletion this
  // script has no mandate to make.
  const orphans = Object.keys(existing.value).filter((id) => !(id in merged));
  for (const id of orphans) merged[id] = existing.value[id];

  /* ---------------------------------------------------------- the report -- */

  const w = { source: 22, health: 13, boards: 6, entries: 8, upstream: 24 };
  const line = (source, health, boards, entries, upstream, action) =>
    `  ${pad(source, w.source)}${pad(health, w.health)}${padStart(boards, w.boards)}` +
    `${padStart(entries, w.entries)}   ${pad(upstream, w.upstream)}${action}`;

  out(line("source", "health", "boards", "entries", "upstream updated", "snapshot"));
  out(`  ${"-".repeat(w.source + w.health + w.boards + w.entries + w.upstream + 11)}`);
  for (const row of rows) {
    out(line(row.sourceId, row.health, row.boards, row.entries, row.upstream, row.action));
  }
  out();

  if (failures.length > 0) {
    out(`${failures.length} source(s) did not yield usable live data:`);
    for (const failure of failures) {
      out(`  ${failure.sourceId}`);
      out(`    ${failure.message}`);
    }
    out(
      "  Their existing snapshot entries were left untouched. A source that " +
        "stays here\n  across runs has a broken fetcher in src/lib/fetchers/ " +
        "that needs a human.",
    );
    out();
  }

  if (shrunk.length > 0) {
    out(`${shrunk.length} source(s) came back live but smaller than the snapshot they replaced:`);
    for (const item of shrunk) {
      out(`  ${item.sourceId}`);
      out(`    ${item.message}`);
    }
    out(
      "  Accepted - it is live data, and refusing it would freeze the snapshot\n" +
        "  forever. But a multi-board source that keeps shrinking is a scraper\n" +
        "  losing one of its pages. --strict treats this as a failure.",
    );
    out();
  }

  if (orphans.length > 0) {
    out(
      `Note: ${orphans.join(", ")} exist(s) in the snapshot but no fetcher ` +
        "produces it any more.\n  Carried through unchanged; prune by hand if " +
        "the source is really gone.",
    );
    out();
  }

  /* ----------------------------------------------------------- the write -- */

  const updated = rows.filter((r) => r.action === "updated" || r.action === "added");
  const contents = serialize(merged);

  // Cheap belt-and-braces: prove the exact bytes we are about to write parse.
  try {
    JSON.parse(contents);
  } catch (cause) {
    fail(`Refusing to write: the assembled snapshot is not valid JSON (${cause.message}).`);
  }

  out("data/leaderboards-snapshot.json");
  out(
    `  ${Object.keys(merged).length} source(s): ${updated.length} refreshed, ` +
      `${rows.length - updated.length} kept from the previous capture` +
      (orphans.length ? `, ${orphans.length} orphaned` : ""),
  );

  let wrote = false;
  if (contents === existing.text) {
    out("  unchanged - not rewritten");
  } else if (opts.dryRun) {
    out("  would be rewritten (--dry-run, so it was not)");
  } else {
    writeAtomic(SNAPSHOT_FILE, contents);
    wrote = true;
    out("  rewritten (temp file + atomic rename)");
  }
  out();

  /* ------------------------------------------- benchmarks: report only --- */

  const benchmarks = readJson(BENCHMARKS_FILE, "data/benchmarks.json");
  const benchUpdatedAt = benchmarks.value?.updatedAt;
  const benchAge = typeof benchUpdatedAt === "string" ? daysSince(benchUpdatedAt) : null;
  const benchStale = benchAge === null || benchAge > BENCHMARK_MAX_AGE_DAYS;

  out("data/benchmarks.json");
  if (benchAge === null) {
    out(`  updatedAt is missing or unparseable (${JSON.stringify(benchUpdatedAt) ?? "absent"})`);
  } else {
    out(`  updatedAt ${benchUpdatedAt} - ${benchAge} day(s) old (threshold ${BENCHMARK_MAX_AGE_DAYS})`);
  }
  if (benchStale) {
    out();
    out("  ####################################################################");
    out("  #  STALE. These scores are hand-curated from vendor model cards    #");
    out("  #  and papers. No API publishes them, so this script cannot        #");
    out("  #  refresh them - only a person can. Re-check the sources listed   #");
    out("  #  in the file, then bump `updatedAt`.                             #");
    out("  ####################################################################");
  } else {
    out("  Fresh enough. Note that only a person can ever refresh this file.");
  }
  out();

  /* ------------------------------------------------------------- verdict -- */

  const nothingSucceeded = rows.length > 0 && updated.length === 0 && failures.length === rows.length;

  if (nothingSucceeded) {
    out("Result: FATAL - not one source returned usable data.");
    out("  The snapshot is intact but every fetcher is failing at once, which");
    out("  usually means a network/DNS problem here rather than eight");
    out("  simultaneous upstream redesigns.");
    return EXIT_FATAL;
  }
  if (failures.length > 0) {
    out(
      `Result: DEGRADED - ${updated.length}/${rows.length} source(s) refreshed, ` +
        `${failures.length} failed.`,
    );
    out(`  The snapshot ${wrote ? "was updated" : "is up to date"} for the sources that worked.`);
    return EXIT_DEGRADED;
  }
  const warnings = [];
  if (benchStale) warnings.push("data/benchmarks.json is stale");
  if (shrunk.length > 0) warnings.push(`${shrunk.length} source(s) shrank`);

  if (warnings.length > 0 && opts.strict) {
    out(`Result: DEGRADED - every source refreshed, but --strict fails on: ${warnings.join("; ")}.`);
    return EXIT_DEGRADED;
  }
  out(`Result: OK - all ${rows.length} source(s) live.`);
  if (warnings.length > 0) {
    out(`  Warnings --strict would fail on: ${warnings.join("; ")}.`);
  }
  return EXIT_OK;
}

main().then(
  (code) => process.exit(code),
  (cause) => fail(cause?.stack ?? String(cause)),
);
