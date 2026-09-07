/**
 * Search-relevance helpers.
 *
 * The supplier's search endpoint matches loosely (it also scans descriptions,
 * and sometimes ignores the keyword entirely), which can surface completely
 * unrelated products — e.g. searching "beras" returning headphones. These
 * helpers re-rank results by matching the query against the product NAME so
 * only genuinely related products are ever shown.
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
 * Rank a product name against a query:
 *  0 = name starts with the full query
 *  1 = name contains the full query
 *  2+ = name contains at least one query token (earlier position = better)
 *  -1 = no match at all
 */
export function rankMatch(name: string, query: string): number {
  const n = normalizeForSearch(name);
  const full = normalizeForSearch(query);
  if (!n || !full) return -1;
  if (n.startsWith(full)) return 0;
  if (n.includes(full)) return 1;
  const tokens = full.split(" ").filter((t) => t.length >= 3);
  let best = Infinity;
  for (const t of tokens) {
    const idx = n.indexOf(t);
    if (idx !== -1 && idx < best) best = idx;
  }
  return best === Infinity ? -1 : best + 2;
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
