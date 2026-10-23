import type { Metadata } from "next";
import Link from "next/link";
import TopUpHome from "@/components/topup/TopUpHome";
import { getEffectiveTopupProviders } from "@/lib/topup-live";

export const metadata: Metadata = {
  title: "Top Up & Isi Saldo — KTD Store",
  description:
    "Top up game, pulsa, paket data, token listrik, dan e-wallet di KTD Store. Pengisian otomatis setelah pembayaran terverifikasi.",
  alternates: { canonical: "/topup" },
  openGraph: {
    type: "website",
    url: "/topup",
    title: "Top Up & Isi Saldo — KTD Store",
    description:
      "Top up game, pulsa, paket data, token listrik, dan e-wallet di KTD Store. Pengisian otomatis setelah pembayaran terverifikasi.",
    images: [{ url: "/images/logo.png", width: 512, height: 512, alt: "KTD Store" }],
    siteName: "KTD Store",
    locale: "id_ID",
  },
  twitter: {
    card: "summary",
    title: "Top Up & Isi Saldo — KTD Store",
    description:
      "Top up game, pulsa, paket data, token listrik, dan e-wallet di KTD Store.",
    images: ["/images/logo.png"],
  },
};

export default async function TopUpPage() {
  // Katalog efektif (statis + override DB) — SKU mati dan nominal baru hasil
  // sinkron otomatis ikut tampil di beranda tanpa menunggu regen.
  const providers = await getEffectiveTopupProviders();
  return (
    <div className="container-site py-5">
      {/* Breadcrumb */}
      <nav
        className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" 
        aria-label="Breadcrumb"
      >
        <Link href="/" className="transition-colors hover:text-brand">
          Beranda
        </Link>
        <span>/</span>
        <span className="text-muted">Top Up &amp; Isi Saldo</span>
      </nav>

      <TopUpHome providers={providers} />
    </div>
  );
}
