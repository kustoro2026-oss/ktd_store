import { NextRequest, NextResponse } from "next/server";
import { filterByRelevance, shuffleSeeded } from "@/lib/search";
import { getLocalImages } from "@/lib/localImages";
import { getStaticCategories, getStaticProducts } from "@/lib/products-cache";
import { isFlashSaleProduct, shuffleArray } from "@/lib/promo";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const flashsale = searchParams.get("flashsale") === "1";
  const sort = searchParams.get("sort") ?? "";

  let products = getStaticProducts();

  // Apply filters from static cache
  if (search) {
    products = filterByRelevance(products, search);
  }
  if (category) {
    // Match category by product's `category` field first (exact match),
    // then fall back to name-based relevance matching for products that
    // don't have a category assigned yet.
    const exactMatch = products.filter(
      (p) => (p as { category?: string }).category?.toLowerCase() === category.toLowerCase(),
    );
    if (exactMatch.length > 0) {
      products = exactMatch;
    } else {
      // Fallback: match the category slug against product names.
      const catName =
        getStaticCategories()
          .find((c) => c.slug.toLowerCase() === category.toLowerCase())
          ?.name ?? category;
      products = filterByRelevance(products, catName);
    }
  }

  // Shuffle search results so aneka & Evermos products are mixed — same seed
  // as SSR /produk so ordering & pagination stay consistent.
  if (search) {
    products = shuffleSeeded(
      products,
      `search|${search.trim().toLowerCase()}|${category.trim().toLowerCase()}`,
    );
  }

  // Flash Sale: hanya produk eligible (harga, stok, profit) dari seluruh katalog
  if (flashsale) {
    products = products.filter((p) =>
      isFlashSaleProduct(p.rekomendasiJual, p.stok, p.hargaModal),
    );
  }

  // Urutan acak (rotasi Flash Sale) — sebelum paginasi
  if (sort === "random") {
    products = shuffleArray(products);
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
