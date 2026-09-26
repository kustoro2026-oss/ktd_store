import type { Metadata } from "next";
import dynamic from "next/dynamic";
import HeroCarousel from "@/components/HeroCarousel";
import Features from "@/components/Features";
import { NewProducts, PopularCategories } from "@/components/HomeSections";
import { getLocalImages } from "@/lib/localImages";
import {
  getStaticAnekaProducts,
  getStaticCategories,
  getStaticEvermosProducts,
  getStaticProducts,
} from "@/lib/products-cache";
import {
  hourSeed,
  parseSold,
  pickHourly,
  POOL_SIZE,
  SALT_BARU,
  SALT_LARIS,
} from "@/lib/hourlyProducts";
import type { AnekaProduct, CardProduct } from "@/lib/anekadropship";
import { isFlashSaleProduct } from "@/lib/promo";

// Lazy-load below-fold sections
const FlashSale = dynamic(() => import("@/components/FlashSale"));
const BestSellers = dynamic(() => import("@/components/BestSellers"));
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

/** Produk cache → kartu ringan (pakai gambar lokal bila tersedia). */
function toCard(p: AnekaProduct): CardProduct {
  const local = getLocalImages(p.id);
  return {
    id: p.id,
    name: p.name,
    image: local.length ? local[0] : p.image,
    rekomendasiJual: p.rekomendasiJual,
    stok: p.stok,
    terjual: p.terjual,
    marketplace: p.marketplace,
  };
}

/** n produk dengan penjualan terbanyak. */
function topBySold(list: AnekaProduct[], n: number): AnekaProduct[] {
  return [...list].sort((a, b) => parseSold(b.terjual) - parseSold(a.terjual)).slice(0, n);
}

export default async function Home() {
  // 100% static — no external network calls.
  const staticCats = getStaticCategories();

  // Seluruh katalog gabungan (aneka + Evermos) untuk pool Flash Sale.
  const allProducts = getStaticProducts();

  // Rotasi per jam untuk "Produk Terbaru" & "Produk Terlaris": masing-masing
  // 16 aneka + 16 Evermos, acak namun deterministik per jam (lihat
  // src/lib/hourlyProducts.ts). Seed dihitung saat render/ISR; klien
  // menghitung ulang saat jam berganti.
  const aneka = getStaticAnekaProducts();
  const evm = getStaticEvermosProducts();
  const seed = hourSeed();
  const poolBaruAneka = aneka.slice(0, POOL_SIZE).map(toCard);
  const poolBaruEvm = evm.slice(0, POOL_SIZE).map(toCard);
  const poolLarisAneka = topBySold(aneka, POOL_SIZE).map(toCard);
  const poolLarisEvm = topBySold(evm, POOL_SIZE).map(toCard);

  // Flash Sale: pool awal dari produk eligible di SELURUH katalog (bukan 20
  // pertama) supaya render awal sudah bisa menampilkan >= 10 kartu.
  const flashInitial = allProducts
    .filter((p) => isFlashSaleProduct(p.rekomendasiJual, p.stok, p.hargaModal))
    .slice(0, 20)
    .map((p) => {
      const local = getLocalImages(p.id);
      return local.length ? { ...p, image: local[0] } : p;
    });

  return (
    <>
      <div className="container-site mt-3">
        <HeroCarousel />
      </div>
      <Features />
      <FlashSale initialProducts={flashInitial} />
      <PopularCategories initialCategories={staticCats} />
      <NewProducts
        anekaPool={poolBaruAneka}
        evmPool={poolBaruEvm}
        initialItems={pickHourly(poolBaruAneka, poolBaruEvm, seed, SALT_BARU)}
        initialSeed={seed}
      />
      <BestSellers
        anekaPool={poolLarisAneka}
        evmPool={poolLarisEvm}
        initialItems={pickHourly(poolLarisAneka, poolLarisEvm, seed, SALT_LARIS)}
        initialSeed={seed}
      />
      <LatestCollections />
      <BlogSection />
      <SeoText />
    </>
  );
}
