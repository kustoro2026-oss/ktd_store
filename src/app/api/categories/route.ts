import { NextResponse } from "next/server";
import { anekaClient } from "@/lib/anekadropship";

export const dynamic = "force-dynamic";

// Simple in-memory cache for categories (clear on restart).
let cache: { data: unknown; ts: number } | null = null;
const TTL = 5 * 60_000; // 5 minutes

// Edge/CDN caching — category lists barely change; serve them from the edge.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) {
    return NextResponse.json(cache.data, { headers: CACHE_HEADERS });
  }

  try {
    const categories = await anekaClient.getCategories();
    const data = { categories };
    cache = { data, ts: Date.now() };
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch categories" },
      { status: 502 },
    );
  }
}
