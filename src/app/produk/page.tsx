import type { Metadata } from "next";
import PlpContent from "./PlpContent";
import type { AnekaCategory, AnekaProduct } from "@/lib/anekadropship";
import { filterByRelevance } from "@/lib/search";
import { getLocalImages } from "@/lib/localImages";
import { getStaticCategories, getStaticProducts } from "@/lib/products-cache";

// Regenerate listing pages at most every 5 minutes.
export const revalidate = 300;

function getProducts(search: string, category: string, page: number) {
  let products = getStaticProducts();

  if (search) {
    products = filterByRelevance(products, search);
  }
  if (category) {
    products = products.filter((p) => (p as { category?: string }).category === category);
  }

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
      categories={categories}
      products={products}
      totalPages={totalPages}
      page={page}
      search={search}
      category={category}
    />
  );
}
