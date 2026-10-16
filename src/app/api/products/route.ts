import { NextRequest, NextResponse } from "next/server";
import { getLocalImages } from "@/lib/localImages";
import { filterAndRankProducts } from "@/lib/produk-listing";
import { getStaticProducts } from "@/lib/products-cache";
import { muatHargaKtd } from "@/lib/ktd-store-harga";
import { isFlashSaleProduct, shuffleArray } from "@/lib/promo";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // Harga override KTD Store (±5 menit cache) — dipakai getStaticProducts di bawah.
  await muatHargaKtd();

  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const flashsale = searchParams.get("flashsale") === "1";
  const sort = searchParams.get("sort") ?? "";

  // Filter + urutan identik dengan SSR /produk (lib bersama).
  let products = filterAndRankProducts(getStaticProducts(), search, category);

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
