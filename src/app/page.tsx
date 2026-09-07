import HeroCarousel from "@/components/HeroCarousel";
import { Features, NewProducts, PopularCategories } from "@/components/HomeSections";
import { BlogSection, LatestCollections, SeoText } from "@/components/Sections";
import { anekaClient, type AnekaCategory, type AnekaProduct } from "@/lib/anekadropship";

// Regenerate the homepage at most every 5 minutes so products stay fresh
// without scraping anekadropship.id on every single request.
export const revalidate = 300;

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
  const [categories, { products }] = await Promise.all([
    anekaClient.getCategories(),
    anekaClient.getNewestProducts({ page: 1 }),
  ]);
  cache = { categories, products, ts: Date.now() };
  return cache;
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
