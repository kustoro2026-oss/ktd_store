import { NextRequest, NextResponse } from "next/server";
import { anekaClient } from "@/lib/anekadropship";

// Never statically optimize this route (it fetches external data at runtime).
export const dynamic = "force-dynamic";

type Suggestion = { id: string; name: string; image: string };

// In-memory cache of recent suggestion queries (per server instance).
const cache = new Map<string, { data: Suggestion[]; ts: number }>();
const TTL = 3 * 60_000; // 3 minutes
const MAX_ENTRIES = 300;
const LIMIT = 8;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ suggestions: [] });

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json({ suggestions: hit.data });
  }

  try {
    const { products } = await anekaClient.getProducts({ search: q, page: 1 });

    // Upstream search matches loosely (it also scans descriptions), so only
    // suggest products whose name actually contains the query. When nothing
    // matches by name, fall back to the loose upstream results rather than
    // showing an empty dropdown.
    const ql = key;
    const matches = products.filter((p) => p.name.toLowerCase().includes(ql));
    const pool = matches.length > 0 ? matches : products;

    const suggestions: Suggestion[] = pool.slice(0, LIMIT).map((p) => ({
      id: p.id,
      name: p.name,
      image: p.image,
    }));

    if (cache.size >= MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { data: suggestions, ts: Date.now() });
    return NextResponse.json({ suggestions });
  } catch {
    // Upstream unreachable / timed out — degrade gracefully instead of 502.
    return NextResponse.json({ suggestions: [] });
  }
}
