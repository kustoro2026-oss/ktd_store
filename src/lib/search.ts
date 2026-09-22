/**
 * Search-relevance helpers.
 *
 * The supplier's search endpoint matches loosely (it also scans descriptions,
 * and sometimes ignores the keyword entirely), which can surface completely
 * unrelated products — e.g. searching "beras" returning headphones. These
 * helpers re-rank results by matching the query against the product NAME so
 * only genuinely related products are ever shown.
 *
 * Strategy (ordered by priority):
 *  0 = name starts with the full query phrase
 *  1 = name contains the full query phrase
 *  2 = ALL query tokens match as whole words (any order)
 *  3 = ALL query tokens match as prefixes (for terms >= 3 chars)
 *  4 = at least HALF the query tokens match (partial match)
 *  5 = at least ONE query token matches (weak match)
 *  -1 = no match at all
 */

/** Lowercase, then collapse every non-alphanumeric run into a single space. */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find `term` in a list of normalized words.
 * Returns the index of the best match, or -1 if not found.
 *
 * Matching strategy (in order):
 *  1. Exact whole-word match
 *  2. Prefix match (for terms >= 3 chars, e.g. "clut" → "clutch")
 *  3. Word contains the term (for terms >= 4 chars, e.g. "lutch" → "clutch")
 */
function wordIndex(words: string[], term: string): number {
  // Exact match
  const exact = words.findIndex((w) => w === term);
  if (exact !== -1) return exact;
  // Prefix match (term length >= 3)
  if (term.length >= 3) {
    const prefix = words.findIndex((w) => w.startsWith(term));
    if (prefix !== -1) return prefix;
  }
  // Contains match (term length >= 4, e.g. "lutch" inside "clutch")
  if (term.length >= 4) {
    const contains = words.findIndex((w) => w.includes(term));
    if (contains !== -1) return contains;
  }
  return -1;
}

/**
 * Rank a product name against a query.
 *
 * Rank values (lower = better):
 *  0 = name starts with the full query phrase
 *  1 = name contains the full query phrase
 *  2 = ALL query tokens match as whole words
 *  3 = ALL query tokens match (prefix or contains)
 *  4 = majority of tokens match
 *  5 = at least one token matches
 *  -1 = no match at all
 */
export function rankMatch(name: string, query: string): number {
  const n = normalizeForSearch(name);
  const full = normalizeForSearch(query);
  if (!n || !full) return -1;
  const tokens = full.split(" ").filter((t) => t.length >= 2);
  if (tokens.length === 0) return -1;
  const words = n.split(" ");

  // Rank 0-1: full phrase match
  if (n.includes(full)) return n.startsWith(full) ? 0 : 1;

  // Count how many tokens match
  let exactMatches = 0;
  let looseMatches = 0;
  let bestIdx = Infinity;

  for (const t of tokens) {
    const exactIdx = words.findIndex((w) => w === t);
    if (exactIdx !== -1) {
      exactMatches++;
      if (exactIdx < bestIdx) bestIdx = exactIdx;
      continue;
    }
    const looseIdx = wordIndex(words, t);
    if (looseIdx !== -1) {
      looseMatches++;
      if (looseIdx < bestIdx) bestIdx = looseIdx;
    }
  }

  const totalMatches = exactMatches + looseMatches;
  if (totalMatches === 0) return -1;

  // Use a composite key (tier * 10000 + bestIdx) so the match-quality tier
  // always takes precedence over the position of the first match.
  // Rank 2: ALL tokens match as whole words
  if (exactMatches === tokens.length) return 2 * 10000 + bestIdx;

  // Rank 3: ALL tokens match (including prefix/contains)
  if (totalMatches === tokens.length) return 3 * 10000 + bestIdx;

  // Rank 4: majority match (> 50%)
  if (totalMatches >= Math.ceil(tokens.length / 2)) return 4 * 10000 + bestIdx;

  // Rank 5: at least one match
  return 5 * 10000 + bestIdx;
}

/**
 * Keep only items whose name actually matches the query, best matches first.
 * An empty query returns the items unchanged.
 */
export function filterByRelevance<T extends { name: string }>(
  items: T[],
  query: string,
): T[] {
  if (!query.trim()) return items;
  return items
    .map((p) => ({ p, rank: rankMatch(p.name, query) }))
    .filter((x) => x.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.p);
}
