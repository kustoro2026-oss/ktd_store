import { NextRequest, NextResponse } from "next/server";
import { anekaClient } from "@/lib/anekadropship";
import { filterByRelevance } from "@/lib/search";
import { getLocalImages } from "@/lib/localImages";

// Never statically optimize this route (it fetches external data at runtime).
export const dynamic = "force-dynamic";

type Suggestion = { id: string; name: string; image: string };

// In-memory cache of recent suggestion queries (per server instance).
const cache = new Map<string, { data: Suggestion[]; ts: number }>();
const TTL = 3 * 60_000; // 3 minutes
const MAX_ENTRIES = 300;
const LIMIT = 8;

// Edge/CDN caching for the hottest queries (prefixes repeat while typing).
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ suggestions: [] });

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json({ suggestions: hit.data }, { headers: CACHE_HEADERS });
  }

  try {
    const { products } = await anekaClient.getProducts({ search: q, page: 1 });

    // The upstream search matches loosely (it also scans descriptions and can
    // return completely unrelated items), so only suggest products whose NAME
    // actually matches the query. If nothing matches, return an empty list —
    // never fall back to unrelated upstream results.
    const suggestions: Suggestion[] = filterByRelevance(products, q)
      .slice(0, LIMIT)
      .map((p) => {
        // Gunakan gambar lokal (hasil sinkronisasi) agar tidak ada hotlink eksternal.
        const local = getLocalImages(p.id);
        return {
          id: p.id,
          name: p.name,
          image: local.length ? local[0] : p.image,
        };
      });

    if (cache.size >= MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { data: suggestions, ts: Date.now() });
    return NextResponse.json({ suggestions }, { headers: CACHE_HEADERS });
  } catch {
    // Upstream unreachable / timed out — degrade gracefully instead of 502.
    return NextResponse.json({ suggestions: [] });
  }
}
