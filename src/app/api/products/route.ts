import { NextRequest, NextResponse } from "next/server";
import { anekaClient } from "@/lib/anekadropship";

// Simple in-memory cache (per server instance). Clear on restart.
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 5 * 60_000; // 5 minutes
const MAX_ENTRIES = 300;

// Allow the Vercel/CDN edge cache to serve repeat requests without invoking
// this function at all. Bursts of identical requests (popular listings)
// bypass the scraper-backed path entirely.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
};

// Never statically optimize this route (it fetches external data at runtime).
export const dynamic = "force-dynamic";

function cacheSet(key: string, data: unknown) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = {
    search: searchParams.get("search") ?? "",
    category: searchParams.get("category") ?? "",
    location: searchParams.get("location") ?? "all",
    seller: searchParams.get("seller") ?? "all",
    page: Number(searchParams.get("page") ?? "1"),
  };
  const sort = searchParams.get("sort") ?? "";

  const key = `${query.search}|${query.category}|${query.location}|${query.seller}|${query.page}|${sort}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json(hit.data, { headers: CACHE_HEADERS });
  }

  try {
    const { products, totalPages } =
      sort === "newest"
        ? await anekaClient.getNewestProducts(query)
        : await anekaClient.getProducts(query);
    const data = { products, page: query.page, totalPages };
    cacheSet(key, data);
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch products" },
      { status: 502 },
    );
  }
}
