import { NextRequest, NextResponse } from "next/server";
import { anekaClient } from "@/lib/anekadropship";
import { filterByRelevance } from "@/lib/search";
import { getLocalImages } from "@/lib/localImages";
import { getStaticProducts } from "@/lib/products-cache";

// Allow the Vercel/CDN edge cache to serve repeat requests without invoking
// this function at all. Bursts of identical requests (popular listings)
// bypass the scraper-backed path entirely.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
};

// Never statically optimize this route (it fetches external data at runtime).
export const dynamic = "force-dynamic";

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

  // 1. Static cache — serve instantly for default listing (page 1, newest, no filters)
  const isDefaultListing = !query.search && !query.category && query.page === 1 && sort === "newest";
  if (isDefaultListing) {
    const staticProds = getStaticProducts();
    if (staticProds.length > 0) {
      // Apply local images to static products
      const localized = staticProds.map((p) => {
        const local = getLocalImages(p.id);
        return local.length ? { ...p, image: local[0] } : p;
      });
      return NextResponse.json(
        { products: localized, page: 1, totalPages: Math.ceil(staticProds.length / 20) },
        { headers: CACHE_HEADERS },
      );
    }
  }

  // 2. For filtered/search queries or when static cache is empty: try live scrape
  //    (requires CF_CLEARANCE env var to bypass Cloudflare)
  try {
    const { products, totalPages } =
      sort === "newest"
        ? await anekaClient.getNewestProducts(query)
        : await anekaClient.getProducts(query);

    // Merge Malaysia products into the main listing
    let mergedProducts = products;
    let mergedTotalPages = totalPages;
    if (!query.category) {
      try {
        const malaysia = await anekaClient.getMalaysiaProducts({ page: query.page });
        const seen = new Set(products.map((p) => p.id));
        const newProducts = malaysia.products.filter((p) => !seen.has(p.id));
        mergedProducts = [...products, ...newProducts];
        mergedTotalPages = Math.max(totalPages, malaysia.totalPages);
      } catch {
        // Malaysia page unreachable — proceed with regular products only.
      }
    }

    const relevant = query.search ? filterByRelevance(mergedProducts, query.search) : mergedProducts;
    const localized = relevant.map((p) => {
      const local = getLocalImages(p.id);
      return local.length ? { ...p, image: local[0] } : p;
    });
    return NextResponse.json(
      { products: localized, page: query.page, totalPages: mergedTotalPages },
      { headers: CACHE_HEADERS },
    );
  } catch (err) {
    // 3. Ultimate fallback: return static cache even for filtered queries
    const staticProds = getStaticProducts();
    if (staticProds.length > 0) {
      let filtered = staticProds;
      if (query.search) filtered = filterByRelevance(filtered, query.search);
      if (query.category) {
        filtered = filtered.filter((p) =>
          (p as { category?: string }).category === query.category,
        );
      }
      const localized = filtered.map((p) => {
        const local = getLocalImages(p.id);
        return local.length ? { ...p, image: local[0] } : p;
      });
      return NextResponse.json(
        { products: localized, page: query.page, totalPages: Math.ceil(filtered.length / 20) },
        { headers: CACHE_HEADERS },
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch products" },
      { status: 502 },
    );
  }
}
