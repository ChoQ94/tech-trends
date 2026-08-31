import { getModelMap } from "@/lib/models";

/**
 * Joining a leaderboard row to a catalog model.
 *
 * Every board names models differently — "Claude 4.5 Opus (high)",
 * "claude-opus-4-6-high", "anthropic/claude-opus-4.6:thinking", "Opus 5" —
 * so each fetcher needs its own way in. What they must all agree on is the
 * part that decides *whether a name is allowed to claim a model*, and that
 * is what lives here:
 *
 *   - matching is exact, never fuzzy or scored;
 *   - a key claimed by two different models resolves to `null` rather than
 *     being awarded to whichever was indexed first;
 *   - a name that lands on nothing stays unmapped and keeps its raw label.
 *
 * Two index shapes are needed, because two families of board name models in
 * genuinely different ways:
 *
 *   - a *token* index, for boards that print human names whose word order
 *     drifts ("Claude Opus 4.5" vs "Claude 4.5 Opus");
 *   - a *slug* index, for boards that print API-style ids.
 *
 * Anything above that — which effort suffixes a site welds on, which vendor
 * prefixes it omits, how it spells a slug — is that site's own quirk and
 * belongs in that site's fetcher, calling down into the lookups here.
 */

/* -------------------------------------------------------------------------
 * Token index — for boards that print human-readable model names.
 * ---------------------------------------------------------------------- */

/** Splits a display name into the words a key is built from. */
export type Tokenizer = (value: string) => string[];

export interface TokenizeOptions {
  /**
   * Drop `(…)` groups before tokenising. Boards that park a reasoning effort
   * in a trailing parenthetical — "Claude 4.5 Opus (high)" — want this, so the
   * effort never becomes part of the key. Boards whose names carry no such
   * marker leave it off, so nothing is silently discarded.
   */
  stripParentheticals?: boolean;
}

/**
 * Lowercase, then reduce to alphanumeric-and-dot words. The dot is kept
 * because version numbers ("4.5") are part of a model's identity.
 */
export function makeTokenizer(options: TokenizeOptions = {}): Tokenizer {
  const { stripParentheticals = false } = options;
  return (value: string): string[] => {
    const base = stripParentheticals
      ? value.toLowerCase().replace(/\([^)]*\)/g, " ")
      : value.toLowerCase();
    return base
      .replace(/[^a-z0-9.]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  };
}

/** Order-insensitive key: "Claude Opus 4.5" and "Claude 4.5 Opus" agree. */
export function tokenKey(parts: string[]): string {
  return [...parts].sort().join(" ");
}

export interface TokenIndex {
  /** The tokenizer this index was built with; a lookup must reuse it. */
  readonly tokenize: Tokenizer;
  /** Full model name and id. */
  readonly primary: Map<string, string | null>;
  /** Model name minus its leading word, for boards that print short names. */
  readonly secondary: Map<string, string | null>;
}

/** A key claimed by two different models is ambiguous and matches nothing. */
function add(map: Map<string, string | null>, k: string, id: string): void {
  if (!k) return;
  if (map.has(k) && map.get(k) !== id) map.set(k, null);
  else map.set(k, id);
}

/**
 * The minimum a thing needs to be indexable. `aliases` is what keeps the
 * joins alive across the catalog's move to OpenRouter ids: a model carries
 * the id and name it used to be known by, so a board name that resolved
 * yesterday still resolves today.
 */
export interface IndexableModel {
  id: string;
  name: string;
  aliases?: string[];
}

/**
 * The catalog indexed by name and id, plus — at two-or-more tokens only — the
 * name minus its leading vendor word, so a board printing "Opus 5" still
 * resolves while a bare "Chat" or "Max" can never claim a model.
 *
 * Pure: takes the models rather than reaching for the catalog, so the same
 * rules can be pointed at a different set of models (matching one catalog
 * against another, say) without a second implementation drifting out of sync.
 */
export function buildTokenIndexFrom(
  tokenize: Tokenizer,
  models: Iterable<IndexableModel>,
  /**
   * The tokenizer used to build the *keys*, which is not always the one used
   * to look them up. `stripParentheticals` exists to normalise what a board
   * writes — "Claude 4.5 Opus (high)" — and applying it to our own labels as
   * well is a different thing entirely: it erases the only word separating
   * "Claude Opus 5 (Fast)" from "Claude Opus 5", the two collide, and the
   * ambiguity rule then correctly refuses both. The catalog is indexed as
   * written; only the incoming name is normalised.
   */
  indexTokenize: Tokenizer = tokenize,
): TokenIndex {
  const primary = new Map<string, string | null>();
  const secondary = new Map<string, string | null>();
  const seen = new Set<string>();
  for (const model of models) {
    // A map keyed by both old and new ids yields the same model twice;
    // indexing it twice is harmless but pointless, and skipping it keeps
    // the collision rule below meaning what it says.
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    for (const label of [model.name, model.id, ...(model.aliases ?? [])]) {
      if (!label) continue;
      const parts = indexTokenize(label);
      add(primary, tokenKey(parts), model.id);
      const rest = parts.slice(1);
      if (rest.length >= 2) add(secondary, tokenKey(rest), model.id);
    }
  }
  return { tokenize, primary, secondary };
}

/** The live catalog, indexed. */
export async function buildTokenIndex(
  tokenize: Tokenizer,
): Promise<TokenIndex> {
  return buildTokenIndexFrom(
    tokenize,
    (await getModelMap()).values(),
    makeTokenizer(),
  );
}

/**
 * Resolve an already-tokenised name. Exposed separately from
 * `matchByTokens` so a fetcher can retry with its own transformation of the
 * tokens (dropping a trailing effort word, say) without re-deriving them.
 */
export function lookupTokens(index: TokenIndex, parts: string[]): string | null {
  const k = tokenKey(parts);
  if (!k) return null;
  // A key present in `primary` with a null value means two models claim it.
  // That is a refusal, not a miss: falling through to the looser `secondary`
  // map would answer an ambiguous name with a guess. `has` is required here
  // because `??` cannot tell a stored null from an absent key.
  if (index.primary.has(k)) return index.primary.get(k) ?? null;
  return index.secondary.get(k) ?? null;
}

/** Resolve a raw display name straight through the index's own tokenizer. */
export function matchByTokens(
  index: TokenIndex,
  rawName: string,
): string | null {
  return lookupTokens(index, index.tokenize(rawName));
}

/* -------------------------------------------------------------------------
 * Slug index — for boards that print API-style ids.
 * ---------------------------------------------------------------------- */

/** Lowercase, hyphen-separated, no leading or trailing hyphens. */
export function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface SlugIndex {
  readonly exact: Map<string, string>;
  readonly compact: Map<string, string>;
}

/**
 * Catalog ids and names, normalized, plus a separator-free key so that
 * "Qwen 3.8 Max" still lands on "Qwen3.8-Max". A compact key claimed by two
 * different models is dropped rather than resolved arbitrarily. Pure, for the
 * same reason `buildTokenIndexFrom` is.
 */
export function buildSlugIndexFrom(
  models: Iterable<IndexableModel>,
): SlugIndex {
  const exact = new Map<string, string>();
  const compact = new Map<string, string>();
  const collided = new Set<string>();
  const seen = new Set<string>();

  for (const model of models) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    for (const label of [model.id, model.name, ...(model.aliases ?? [])]) {
      if (!label) continue;
      const key = normalizeSlug(label);
      if (!key) continue;
      // An exact key already claimed by another model is left with its first
      // owner rather than reassigned; `compact` below refuses outright.
      if (!exact.has(key)) exact.set(key, model.id);
      const flat = key.replace(/-/g, "");
      const held = compact.get(flat);
      if (held !== undefined && held !== model.id) collided.add(flat);
      else compact.set(flat, model.id);
    }
  }
  for (const key of collided) compact.delete(key);

  return { exact, compact };
}

/** The live catalog, indexed. */
export async function buildSlugIndex(): Promise<SlugIndex> {
  return buildSlugIndexFrom((await getModelMap()).values());
}

/** Exact match only — a near miss stays unmapped rather than mis-attributed. */
export function lookupSlug(index: SlugIndex, key: string): string | null {
  return index.exact.get(key) ?? index.compact.get(key.replace(/-/g, "")) ?? null;
}
