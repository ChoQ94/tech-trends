import { DATA_TTL_SECONDS } from "@/lib/cache";
import {
  buildSlugIndex,
  lookupSlug,
  normalizeSlug,
} from "@/lib/model-match";
import { fallbackResult, liveResult } from "@/lib/snapshot";
import type { Leaderboard, LeaderboardEntry, LeaderboardResult } from "@/lib/types";

const SOURCE_ID = "epoch-eci";
const ENDPOINT = "https://epoch.ai/data/eci_scores.csv";
const PAGE_URL = "https://epoch.ai/data/ai-benchmarking-dashboard";
const USER_AGENT =
  "tech-trends-dashboard/1.0 (leaderboard aggregator; +https://epoch.ai/data/ai-benchmarking-dashboard)";

const TOP_N = 25;

/** Columns we require; anything else in the file is ignored. */
const REQUIRED_COLUMNS = ["Model", "eci", "eci_ci_low", "eci_ci_high"] as const;

/**
 * A minimal RFC 4180 reader. The organisation column contains commas inside
 * quotes ("Google DeepMind,Google"), so splitting on commas would silently
 * shift every later column — hence a real parser rather than a split, and
 * still no new dependency.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      // Close the record on \n, \r or \r\n, but never on a blank line.
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export async function fetch_epoch(): Promise<LeaderboardResult> {
  let text: string;
  let lastModified: string | null = null;
  try {
    const response = await fetch(ENDPOINT, {
      headers: { accept: "text/csv", "user-agent": USER_AGENT },
      next: { revalidate: DATA_TTL_SECONDS },
    });
    if (!response.ok) {
      return fallbackResult(
        SOURCE_ID,
        `Epoch AI의 ECI CSV가 HTTP ${response.status}을(를) 반환했습니다.`,
      );
    }
    lastModified = response.headers.get("last-modified");
    text = await response.text();
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return fallbackResult(
      SOURCE_ID,
      `Epoch AI의 ECI CSV를 내려받지 못했습니다: ${reason}`,
    );
  }

  try {
    const rows = parseCsv(text);
    if (rows.length < 2) {
      return fallbackResult(
        SOURCE_ID,
        "Epoch AI의 ECI CSV에 헤더만 있고 데이터 행이 없습니다.",
      );
    }

    const header = rows[0].map((h) => h.trim());
    const column = new Map(header.map((name, i) => [name, i]));
    const missing = REQUIRED_COLUMNS.filter((c) => !column.has(c));
    if (missing.length > 0) {
      return fallbackResult(
        SOURCE_ID,
        `Epoch AI의 ECI CSV에 필요한 열이 없습니다: ${missing.join(", ")}.`,
      );
    }

    const cell = (row: string[], name: string): string | undefined => {
      const i = column.get(name);
      return i === undefined ? undefined : row[i];
    };

    const index = await buildSlugIndex();

    const parsed = rows
      .slice(1)
      .map((row) => {
        const displayName =
          cell(row, "Display name")?.trim() || cell(row, "Model")?.trim() || "";
        const eci = parseNumber(cell(row, "eci"));
        const low = parseNumber(cell(row, "eci_ci_low"));
        const high = parseNumber(cell(row, "eci_ci_high"));
        if (displayName === "" || eci === null) return null;
        return { displayName, eci, low, high };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.eci - a.eci)
      .slice(0, TOP_N);

    if (parsed.length === 0) {
      return fallbackResult(
        SOURCE_ID,
        "Epoch AI의 ECI CSV를 해석했지만 점수가 있는 모델이 하나도 없습니다.",
      );
    }

    const entries: LeaderboardEntry[] = parsed.map((r, i) => ({
      rank: i + 1,
      modelId: lookupSlug(index, normalizeSlug(r.displayName)),
      modelName: r.displayName,
      score: r.eci,
      // Carried so the UI can show that the leaders are statistically tied
      // rather than ordered. Only a complete interval is worth anything.
      ci: r.low !== null && r.high !== null ? { low: r.low, high: r.high } : null,
    }));

    // The CSV carries no build stamp of its own; the CDN's Last-Modified is
    // the only honest upstream timestamp available, and it is often absent.
    const upstreamUpdatedAt =
      lastModified && Number.isFinite(Date.parse(lastModified))
        ? new Date(lastModified).toISOString()
        : null;

    const board: Leaderboard = {
      id: "epoch-eci",
      name: `Epoch Capabilities Index — top ${entries.length}`,
      url: PAGE_URL,
      updatedAt: upstreamUpdatedAt ?? new Date().toISOString(),
      entries,
    };

    return liveResult(SOURCE_ID, [board], upstreamUpdatedAt);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    return fallbackResult(
      SOURCE_ID,
      `Epoch AI의 ECI CSV를 해석하지 못했습니다: ${reason}`,
    );
  }
}
