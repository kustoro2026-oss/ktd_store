/**
 * Search-relevance helpers.
 *
 * The supplier's search endpoint matches loosely (it also scans descriptions,
 * and sometimes ignores the keyword entirely), which can surface completely
 * unrelated products — e.g. searching "beras" returning headphones. These
 * helpers re-rank results by matching the query against the product NAME so
 * only genuinely related products are ever shown.
 *
 * Matching rules (strict — avoids false positives like "tas" → "mengatasi"):
 *  - Whole-word match is always required ("tas" only matches the word "tas",
 *    never "tasbih" / "atasan" / "mengatasi").
 *  - Prefix match is allowed ONLY for query terms >= 5 chars (e.g. "hijab"
 *    may match the word "hijaber"), never for short terms.
 *  - No mid-word substring matching at all.
 *
 * Rank values (lower = better; composite = tier * 10000 + first-match index):
 *  0      = name starts with the full query phrase (consecutive whole words)
 *  1*1e4  = name contains the full query phrase (consecutive whole words)
 *  2*1e4  = ALL query tokens match as whole words (any order)
 *  3*1e4  = ALL query tokens match (whole word, or prefix for terms >= 5)
 *  4*1e4  = at least HALF the query tokens match (partial match)
 *  5*1e4  = at least ONE query token matches (weak match)
 *  -1     = no match at all
 */

/** Prefix matching is only allowed for query terms this long (spec: >= 5). */
const PREFIX_MIN_LEN = 5;

/** Lowercase, then collapse every non-alphanumeric run into a single space. */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match one query token against the normalized words of a name.
 * Whole-word match always allowed; prefix match only for terms >=
 * PREFIX_MIN_LEN. Returns the best match (exact beats prefix), or null.
 */
function matchWord(words: string[], term: string): { idx: number; exact: boolean } | null {
  const exactIdx = words.findIndex((w) => w === term);
  if (exactIdx !== -1) return { idx: exactIdx, exact: true };
  if (term.length >= PREFIX_MIN_LEN) {
    const prefixIdx = words.findIndex((w) => w.startsWith(term));
    if (prefixIdx !== -1) return { idx: prefixIdx, exact: false };
  }
  return null;
}

/**
 * Find a phrase made of consecutive whole words, e.g. "baju koko" inside
 * "Arra - Baju Koko Al Qorni". Returns the index of the first word, or -1.
 */
function phraseIndex(words: string[], tokens: string[]): number {
  if (tokens.length === 1) return words.indexOf(tokens[0]);
  for (let i = 0; i + tokens.length <= words.length; i += 1) {
    let ok = true;
    for (let j = 0; j < tokens.length; j += 1) {
      if (words[i + j] !== tokens[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

/**
 * Rank a product name against a query (see file header for tier meanings).
 */
export function rankMatch(name: string, query: string): number {
  const n = normalizeForSearch(name);
  const full = normalizeForSearch(query);
  if (!n || !full) return -1;
  const tokens = full.split(" ").filter((t) => t.length >= 2);
  if (tokens.length === 0) return -1;
  const words = n.split(" ");

  // Rank 0-1: full query phrase as consecutive whole words (no substrings).
  const phrasePos = phraseIndex(words, tokens);
  if (phrasePos !== -1) return phrasePos === 0 ? 0 : 10000 + phrasePos;

  let exactMatches = 0;
  let looseMatches = 0;
  let bestIdx = Infinity;

  for (const t of tokens) {
    const m = matchWord(words, t);
    if (!m) continue;
    if (m.exact) exactMatches += 1;
    else looseMatches += 1;
    if (m.idx < bestIdx) bestIdx = m.idx;
  }

  const totalMatches = exactMatches + looseMatches;
  if (totalMatches === 0) return -1;

  // Composite key (tier * 10000 + bestIdx) keeps the match-quality tier
  // above the position of the first match.
  if (exactMatches === tokens.length) return 2 * 10000 + bestIdx;
  if (totalMatches === tokens.length) return 3 * 10000 + bestIdx;
  if (totalMatches >= Math.ceil(tokens.length / 2)) return 4 * 10000 + bestIdx;
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

/** FNV-1a 32-bit hash — deterministic seed from a string. */
function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministically shuffle a list from a string seed (xorshift32 +
 * Fisher-Yates). Used to mix aneka & Evermos search results so they are not
 * grouped per source; the same seed always yields the same order, keeping
 * pagination pages 1..N consistent (no duplicates / gaps) and identical
 * between SSR /produk and /api/products.
 */
export function shuffleSeeded<T>(items: T[], seed: string): T[] {
  const out = items.slice();
  let s = hashSeed(seed) || 0x9e3779b9;
  const next = (): number => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Listing priority ratio: aneka products per 1 Evermos product. */
const ANEKA_PER_EVM = 3;

/**
 * Order a listing with aneka priority: early pages are aneka-majority (e.g.
 * 15 of 20 slots) while Evermos products stay sprinkled in (~1 per group of
 * ANEKA_PER_EVM + 1, insertion slot jittered deterministically). Orders
 * within each source are seeded-shuffled from a shared seed so SSR /produk
 * and /api/products stay identical and pagination pages 1..N remain
 * consistent (no duplicates / gaps). When one source runs out, the other
 * continues (aneka-only or Evermos-only tail).
 */
export function prioritizeAneka<T extends { id: string }>(items: T[], seed: string): T[] {
  const aneka: T[] = [];
  const evermos: T[] = [];
  for (const p of items) {
    if (p.id.startsWith("EVM-")) evermos.push(p);
    else aneka.push(p);
  }
  const a = shuffleSeeded(aneka, `${seed}|a`);
  const e = shuffleSeeded(evermos, `${seed}|e`);
  const out: T[] = [];
  let i = 0;
  let j = 0;
  let s = hashSeed(`${seed}|pos`) || 0x9e3779b9;
  const next = (): number => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  while (i < a.length || j < e.length) {
    if (i >= a.length) {
      // Aneka habis — sisanya produk Evermos.
      out.push(...e.slice(j));
      break;
    }
    const takeA = Math.min(ANEKA_PER_EVM, a.length - i);
    const hasEvm = j < e.length;
    const pos = hasEvm ? Math.floor(next() * (takeA + 1)) : takeA;
    for (let k = 0; k < takeA; k += 1) {
      if (hasEvm && k === pos) out.push(e[j++]);
      out.push(a[i++]);
    }
    if (hasEvm && pos === takeA) out.push(e[j++]);
  }
  return out;
}
