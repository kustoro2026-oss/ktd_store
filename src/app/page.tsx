import type { Metadata } from "next";
import dynamic from "next/dynamic";
import HeroCarousel from "@/components/HeroCarousel";
import Features from "@/components/Features";
import { NewProducts, PopularCategories } from "@/components/HomeSections";
import { anekaClient, type AnekaCategory, type AnekaProduct } from "@/lib/anekadropship";
import { getLocalImages } from "@/lib/localImages";

// Lazy-load below-fold sections — they don't need to block first paint
const FlashSale = dynamic(() => import("@/components/FlashSale"));
const BlogSection = dynamic(() => import("@/components/Sections").then((m) => ({ default: m.BlogSection })));
const LatestCollections = dynamic(() => import("@/components/Sections").then((m) => ({ default: m.LatestCollections })));
const SeoText = dynamic(() => import("@/components/Sections").then((m) => ({ default: m.SeoText })));

// Regenerate the homepage at most every 5 minutes so products stay fresh
// without scraping anekadropship.id on every single request.
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "KTD Store — Belanja Online Produk Pilihan" },
  description:
    "KTD Store adalah toko online produk pilihan langsung dari supplier. Belanja kebutuhan rumah tangga, kecantikan, dan gaya hidup dengan harga terbaik, pesan mudah dan aman via WhatsApp.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "KTD Store — Belanja Online Produk Pilihan",
    description:
      "Produk pilihan langsung dari supplier dengan harga terbaik. Pesan mudah dan aman via WhatsApp.",
    images: [{ url: "/images/logo.png", width: 512, height: 512, alt: "KTD Store — Belanja Online Produk Pilihan" }],
    siteName: "KTD Store",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "KTD Store — Belanja Online Produk Pilihan",
    description:
      "Produk pilihan langsung dari supplier dengan harga terbaik. Pesan mudah dan aman via WhatsApp.",
    images: ["/images/logo.png"],
  },
};

// Module-level cache so ISR regenerations reuse the previous scrape result
// when the upstream site is slow or unreachable.
let cache: {
  categories: AnekaCategory[];
  products: AnekaProduct[];
  ts: number;
} | null = null;
const TTL = 5 * 60_000; // 5 minutes

async function getHomeData() {
  if (cache && Date.now() - cache.ts < TTL) return cache;
  try {
    const [categories, { products: raw }, malaysia] = await Promise.all([
      anekaClient.getCategories(),
      anekaClient.getNewestProducts({ page: 1 }),
      anekaClient.getMalaysiaProducts({ page: 1 }).catch(() => null),
    ]);
    // Merge Malaysia products into the main listing (deduplicate by id).
    let merged = raw;
    if (malaysia) {
      const seen = new Set(raw.map((p) => p.id));
      const newProducts = malaysia.products.filter((p) => !seen.has(p.id));
      merged = [...raw, ...newProducts];
    }
    // Gunakan gambar lokal (hasil sinkronisasi) agar tidak ada hotlink eksternal.
    const products = merged.map((p) => {
      const local = getLocalImages(p.id);
      return local.length ? { ...p, image: local[0] } : p;
    });
    cache = { categories, products, ts: Date.now() };
    return cache;
  } catch {
    // Upstream unreachable — serve stale cache if available, otherwise re-throw.
    if (cache) return cache;
    throw new Error("anekadropship.id unreachable and no cached data available");
  }
}

export default async function Home() {
  // Server-render the first batch of real data (SEO + fast first paint).
  // If the upstream is unreachable, sections fall back to client fetching.
  let categories: AnekaCategory[] | null = null;
  let products: AnekaProduct[] | null = null;
  try {
    const data = await getHomeData();
    categories = data.categories;
    products = data.products;
  } catch {
    // Client-side /api fallback will handle it.
  }

  return (
    <>
      {/* 2. Hero carousel */}
      <div className="container-site mt-3">
        <HeroCarousel />
      </div>

      {/* Trust strip */}
      <Features />

      {/* 3. Flash Sale — produk stok terbatas dengan diskon besar + countdown */}
      <FlashSale initialProducts={products} />

      {/* Kategori (real) */}
      <PopularCategories initialCategories={categories} />

      {/* Produk Terbaru (real) */}
      <NewProducts initialProducts={products} />

      {/* 6. Koleksi Terkini */}
      <LatestCollections />

      {/* 7. Blog */}
      <BlogSection />

      {/* 8. SEO text */}
      <SeoText />
    </>
  );
}
