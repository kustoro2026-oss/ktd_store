import type { Metadata } from "next";
import PlpContent from "./PlpContent";
import { anekaClient, type AnekaCategory, type AnekaProduct } from "@/lib/anekadropship";
import { filterByRelevance } from "@/lib/search";
import { getLocalImages } from "@/lib/localImages";

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
    // The supplier's search is loose; keep only products whose name actually
    // matches the query so unrelated items never appear in search results.
    const filtered = search
      ? { products: filterByRelevance(data.products, search), totalPages: data.totalPages }
      : data;
    // Gunakan gambar lokal (hasil sinkronisasi) agar tidak ada hotlink eksternal.
    const result = {
      ...filtered,
      products: filtered.products.map((p) => {
        const local = getLocalImages(p.id);
        return local.length ? { ...p, image: local[0] } : p;
      }),
    };
    listCache.set(key, { data: result, ts: Date.now() });
    return result;
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
  const page = Math.max(1, Number((sp.page ?? "1").toString()) || 1);

  const listDescription =
    "Jelajahi semua produk pilihan KTD Store. Produk langsung dari supplier dengan harga terbaik, pesan mudah dan aman via WhatsApp.";

  // Search results: unique title/description, but keep them out of the index.
  if (search) {
    const title = `Cari "${search}"`;
    const description = `Hasil pencarian produk "${search}" di KTD Store. Temukan produk pilihan dengan harga terbaik dan pesan mudah via WhatsApp.`;
    return {
      title,
      description,
      alternates: { canonical: "/produk" },
      robots: { index: false, follow: true },
      openGraph: {
        type: "website",
        url: "/produk",
        title,
        description,
        siteName: "KTD Store",
        locale: "id_ID",
      },
    };
  }

  const cats = await getCategories();
  const cat = cats?.find((c) => c.slug.toLowerCase() === category.toLowerCase());
  if (cat) {
    const title = `Kategori ${cat.name}`;
    const description = `Jelajahi produk kategori ${cat.name} di KTD Store. Produk pilihan langsung dari supplier dengan harga terbaik, pesan mudah dan aman via WhatsApp.`;
    return {
      title,
      description,
      alternates: { canonical: `/produk?category=${encodeURIComponent(cat.slug)}` },
      openGraph: {
        type: "website",
        url: `/produk?category=${encodeURIComponent(cat.slug)}`,
        title,
        description,
        siteName: "KTD Store",
        locale: "id_ID",
      },
    };
  }

  // Base listing — pagination pages stay out of the index to avoid duplicates.
  return {
    title: "Semua Produk",
    description: listDescription,
    alternates: { canonical: "/produk" },
    robots: page > 1 ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      url: "/produk",
      title: "Semua Produk KTD Store",
      description: listDescription,
      siteName: "KTD Store",
      locale: "id_ID",
    },
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
