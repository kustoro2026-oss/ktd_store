import { NextResponse } from "next/server";
import { anekaClient } from "@/lib/anekadropship";
import { getStaticCategories } from "@/lib/products-cache";

export const dynamic = "force-dynamic";

// Edge/CDN caching — category lists barely change; serve them from the edge.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
  // 1. Static cache (always available, no network needed)
  const staticCats = getStaticCategories();
  if (staticCats.length > 0) {
    // Background: try live scrape if CF_CLEARANCE is set (for fresh data)
    if (process.env.CF_CLEARANCE) {
      anekaClient.getCategories()
        .then((live) => {
          // Live scrape succeeded — will be used on next request via in-memory cache
        })
        .catch(() => { });
    }
    return NextResponse.json({ categories: staticCats }, { headers: CACHE_HEADERS });
  }

  // 2. Fallback: live scrape (requires CF_CLEARANCE or direct access)
  try {
    const categories = await anekaClient.getCategories();
    return NextResponse.json({ categories }, { headers: CACHE_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch categories" },
      { status: 502 },
    );
  }
}
