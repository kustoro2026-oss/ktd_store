/**
 * Logika listing produk bersama — dipakai oleh SSR /produk,
 * /produk/kategori/[slug], dan /api/products supaya hasil filter,
 * urutan, dan paginasi SELALU identik (invariant sinkronisasi).
 *
 * Aturan filter kategori (union): produk yang field `category`-nya cocok
 * persis DIGABUNG dengan produk sisa yang cocok nama via relevansi — karena
 * item anekadropship punya `category` kosong, exact-match saja akan
 * menggugurkan semua produk aneka.
 */
import type { AnekaProduct } from "@/lib/anekadropship";
import { filterByRelevance, prioritizeAneka } from "@/lib/search";
import { getStaticCategories } from "@/lib/products-cache";

/** Filter keyword + kategori lalu urutkan aneka-prioritas (deterministik). */
export function filterAndRankProducts(
  products: AnekaProduct[],
  search: string,
  category: string,
): AnekaProduct[] {
  let out = products;

  if (search) {
    out = filterByRelevance(out, search);
  }
  if (category) {
    // 1) Produk yang field `category`-nya cocok persis (mayoritas EVM).
    const exactMatch = out.filter(
      (p) => (p as { category?: string }).category?.toLowerCase() === category.toLowerCase(),
    );
    // 2) Sisa produk: cocokkan NAMA kategori dengan nama produk.
    const catName =
      getStaticCategories()
        .find((c) => c.slug.toLowerCase() === category.toLowerCase())
        ?.name ?? category;
    const nameMatch = filterByRelevance(
      out.filter(
        (p) => (p as { category?: string }).category?.toLowerCase() !== category.toLowerCase(),
      ),
      catName,
    );
    out = [...exactMatch, ...nameMatch];
  }

  // Aneka-mayoritas dengan Evermos diselingi (3 aneka : 1 Evermos),
  // deterministik per keyword + kategori agar halaman 1..N konsisten.
  return prioritizeAneka(
    out,
    `listing|${search.trim().toLowerCase()}|${category.trim().toLowerCase()}`,
  );
}

/** Cari kategori dari slug (case-insensitive) — undefined bila tidak ada. */
export function getCategoryBySlug(slug: string) {
  return getStaticCategories().find((c) => c.slug.toLowerCase() === slug.toLowerCase());
}
