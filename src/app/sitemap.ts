import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { anekaClient } from "@/lib/anekadropship";
import { blogPosts } from "@/lib/data";

// Cache the scraped product URLs so sitemap requests don't hit the upstream
// site on every crawl. 30 minutes is plenty — the catalog changes slowly.
let productCache: { urls: string[]; ts: number } | null = null;
const TTL = 30 * 60_000;

async function getProductUrls(): Promise<string[]> {
  if (productCache && Date.now() - productCache.ts < TTL) {
    return productCache.urls;
  }
  try {
    const { products } = await anekaClient.getNewestProducts({ page: 1 });
    const urls = products.map((p) => String(p.id));
    productCache = { urls, ts: Date.now() };
    return urls;
  } catch {
    // Upstream unreachable — fall back to whatever we cached before (if any).
    return productCache?.urls ?? [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/produk`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/cara-belanja`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/konfirmasi-pembayaran`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/tentang-kami`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/karir`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/bantuan`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/syarat-ketentuan`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/tips`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    ...blogPosts.map((b) => ({
      url: `${SITE_URL}/tips/${b.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];

  const productIds = await getProductUrls();
  const productRoutes: MetadataRoute.Sitemap = productIds.map((id) => ({
    url: `${SITE_URL}/produk/${id}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
