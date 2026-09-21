import type { Metadata } from "next";
import dynamic from "next/dynamic";
import HeroCarousel from "@/components/HeroCarousel";
import Features from "@/components/Features";
import { NewProducts, PopularCategories } from "@/components/HomeSections";
import { getLocalImages } from "@/lib/localImages";
import { getStaticCategories, getStaticProducts } from "@/lib/products-cache";

// Lazy-load below-fold sections
const FlashSale = dynamic(() => import("@/components/FlashSale"));
const BlogSection = dynamic(() => import("@/components/Sections").then((m) => ({ default: m.BlogSection })));
const LatestCollections = dynamic(() => import("@/components/Sections").then((m) => ({ default: m.LatestCollections })));
const SeoText = dynamic(() => import("@/components/Sections").then((m) => ({ default: m.SeoText })));

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

export default async function Home() {
  // 100% static — no external network calls.
  const staticCats = getStaticCategories();
  const staticProds = getStaticProducts();

  const products = staticProds.map((p) => {
    const local = getLocalImages(p.id);
    return local.length ? { ...p, image: local[0] } : p;
  });

  return (
    <>
      <div className="container-site mt-3">
        <HeroCarousel />
      </div>
      <Features />
      <FlashSale initialProducts={products} />
      <PopularCategories initialCategories={staticCats} />
      <NewProducts initialProducts={products} />
      <LatestCollections />
      <BlogSection />
      <SeoText />
    </>
  );
}
