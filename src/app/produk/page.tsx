import type { Metadata } from "next";
import PlpContent from "./PlpContent";
import { anekaClient, type AnekaCategory, type AnekaProduct } from "@/lib/anekadropship";

// Regenerate listing pages at most every 5 minutes.
export const revalidate = 300;

// Category list rarely changes — cache it longer than product listings.
let catCache: { data: AnekaCategory[]; ts: number } | null = null;
const CAT_TTL = 30 * 60_000;

async function getCategories(): Promise<AnekaCategory[] | null> {
  if (catCache && Date.now() - catCache.ts < CAT_TTL) return catCache.data;
  try {
    const data = await anekaClient.getCategories();
    catCache = { data, ts: Date.now() };
    return data;
  } catch {
    return null;
  }
}

// Per-query product listing cache (search|category|page).
const listCache = new Map<string, { data: { products: AnekaProduct[]; totalPages: number }; ts: number }>();
const LIST_TTL = 5 * 60_000;

async function getProducts(search: string, category: string, page: number) {
  const key = `${search}|${category}|${page}`;
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.ts < LIST_TTL) return hit.data;
  try {
    const data = await anekaClient.getProducts({ search, category, page });
    listCache.set(key, { data, ts: Date.now() });
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const search = (sp.search ?? "").toString();
  const category = (sp.category ?? "").toString();
  if (search) return { title: `Cari "${search}"` };
  const cats = await getCategories();
  const catName = cats?.find((c) => c.slug.toLowerCase() === category.toLowerCase())?.name;
  if (catName) return { title: `Kategori ${catName}` };
  return {};
}

export default async function ProdukPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const search = (sp.search ?? "").toString();
  const category = (sp.category ?? "").toString();
  const page = Math.max(1, Number((sp.page ?? "1").toString()) || 1);

  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts(search, category, page),
  ]);

  return (
    <PlpContent
      categories={categories}
      products={products ? products.products : null}
      totalPages={products?.totalPages ?? 0}
      category={category}
      search={search}
      page={page}
    />
  );
}
