import { NextRequest, NextResponse } from "next/server";
import { filterByRelevance } from "@/lib/search";
import { getLocalImages } from "@/lib/localImages";
import { getStaticProducts } from "@/lib/products-cache";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const page = Number(searchParams.get("page") ?? "1");

  let products = getStaticProducts();

  // Apply filters from static cache
  if (search) {
    products = filterByRelevance(products, search);
  }
  if (category) {
    products = products.filter((p) => (p as { category?: string }).category === category);
  }

  // Apply local images
  const localized = products.map((p) => {
    const local = getLocalImages(p.id);
    return local.length ? { ...p, image: local[0] } : p;
  });

  // Paginate
  const perPage = 20;
  const start = (page - 1) * perPage;
  const paged = localized.slice(start, start + perPage);

  return NextResponse.json(
    { products: paged, page, totalPages: Math.ceil(localized.length / perPage) },
    { headers: CACHE_HEADERS },
  );
}
