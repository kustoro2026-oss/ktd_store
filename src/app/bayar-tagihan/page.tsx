import type { Metadata } from "next";
import Link from "next/link";
import BayarTagihan from "@/components/topup/BayarTagihan";
import { getEffectivePascaProducts } from "@/lib/topup-live";

export const metadata: Metadata = {
  title: "Bayar Tagihan — KTD Store",
  description:
    "Cek & bayar tagihan pascabayar di KTD Store: PDAM, PBB, PLN, BPJS Kesehatan, BPJS Ketenagakerjaan, internet, TV kabel, dan multifinance. Tagihan diproses otomatis setelah pembayaran terverifikasi.",
  alternates: { canonical: "/bayar-tagihan" },
  openGraph: {
    type: "website",
    url: "/bayar-tagihan",
    title: "Bayar Tagihan — KTD Store",
    description:
      "Cek & bayar tagihan pascabayar di KTD Store: PDAM, PBB, PLN, BPJS, internet, TV kabel, dan multifinance. Tagihan diproses otomatis setelah pembayaran terverifikasi.",
    images: [{ url: "/images/logo.png", width: 512, height: 512, alt: "KTD Store" }],
    siteName: "KTD Store",
    locale: "id_ID",
  },
  twitter: {
    card: "summary",
    title: "Bayar Tagihan — KTD Store",
    description:
      "Cek & bayar tagihan pascabayar di KTD Store: PDAM, PBB, PLN, BPJS, internet, TV kabel, dan multifinance.",
    images: ["/images/logo.png"],
  },
};

export default async function BayarTagihanPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string | string[] }>;
}) {
  // Katalog pasca efektif (statis + override DB) — SKU mati hasil sinkron
  // disembunyikan. Kategori awal dari ?kategori= (tile di beranda).
  const pasca = await getEffectivePascaProducts();
  const sp = await searchParams;
  const kategori = typeof sp.kategori === "string" ? sp.kategori : null;

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
        <span className="text-muted">Bayar Tagihan</span>
      </nav>

      <BayarTagihan products={pasca} initialCategory={kategori} />
    </div>
  );
}
