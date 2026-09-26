import type { Metadata } from "next";
import PlpContent from "./PlpContent";
import { filterByRelevance, prioritizeAneka } from "@/lib/search";
import { getLocalImages } from "@/lib/localImages";
import { getStaticCategories, getStaticProducts } from "@/lib/products-cache";

function getProducts(search: string, category: string, page: number) {
  let products = getStaticProducts();

  if (search) {
    products = filterByRelevance(products, search);
  }
  if (category) {
    // 1) Products whose `category` field matches exactly (mostly EVM items
    //    after the site-category mapping).
    const exactMatch = products.filter(
      (p) => (p as { category?: string }).category?.toLowerCase() === category.toLowerCase(),
    );
    // 2) The remaining products: match the category NAME against product
    //    names — most aneka items have an empty/unusable `category` field,
    //    so exact-match alone would drop every aneka product from the page.
    const catName =
      getStaticCategories()
        .find((c) => c.slug.toLowerCase() === category.toLowerCase())
        ?.name ?? category;
    const nameMatch = filterByRelevance(
      products.filter(
        (p) => (p as { category?: string }).category?.toLowerCase() !== category.toLowerCase(),
      ),
      catName,
    );
    products = [...exactMatch, ...nameMatch];
  }

  // Prioritize aneka products in every listing: early pages are
  // aneka-majority while Evermos items stay sprinkled in (3 aneka : 1
  // Evermos). Deterministic per keyword + category so SSR /produk and
  // /api/products stay identical and pagination pages 1..N remain consistent
  // (no duplicates / gaps).
  products = prioritizeAneka(
    products,
    `listing|${search.trim().toLowerCase()}|${category.trim().toLowerCase()}`,
  );

  const localized = products.map((p) => {
    const local = getLocalImages(p.id);
    return local.length ? { ...p, image: local[0] } : p;
  });

  const perPage = 20;
  const start = (page - 1) * perPage;
  const paged = localized.slice(start, start + perPage);

  return { products: paged, totalPages: Math.ceil(localized.length / perPage) };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const search = (sp.search ?? "").toString();
  const category = (sp.category ?? "").toString();
  const title = search || category || "Semua Produk";
  return {
    title: `${title} — KTD Store`,
    description: `Jelajahi koleksi produk ${title.toLowerCase()} terbaru di KTD Store. Harga terbaik langsung dari supplier.`,
  };
}

export default async function ProdukPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const search = (sp.search ?? "").toString();
  const category = (sp.category ?? "").toString();
  const page = Number(sp.page ?? "1");

  const categories = getStaticCategories();
  const { products, totalPages } = getProducts(search, category, page);

  return (
    <PlpContent
      key={`${search}|${category}|${page}`}
      categories={categories}
      products={products}
      totalPages={totalPages}
      page={page}
      search={search}
      category={category}
    />
  );
}
