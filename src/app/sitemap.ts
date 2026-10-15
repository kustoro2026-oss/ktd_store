import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { blogPosts } from "@/lib/data";
import { getStaticCategories, getStaticProducts } from "@/lib/products-cache";
import { TOPUP_PROVIDERS } from "@/lib/topup";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/produk`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/topup`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
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

  // Halaman kategori (URL bersih) — sama seperti link navigasi internal.
  const categoryRoutes: MetadataRoute.Sitemap = getStaticCategories().map((c) => ({
    url: `${SITE_URL}/produk/kategori/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Halaman provider top-up (Free Fire, pulsa, dll).
  const topupRoutes: MetadataRoute.Sitemap = TOPUP_PROVIDERS.map((p) => ({
    url: `${SITE_URL}/topup/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const products = getStaticProducts();
  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/produk/${p.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...topupRoutes, ...productRoutes];
}
