import type { Metadata } from "next";
import Link from "next/link";
import CekStatus from "@/components/topup/CekStatus";

export const metadata: Metadata = {
  title: "Cek Status Pesanan Top Up — KTD Store",
  description:
    "Cek status top up Anda secara live: masukkan No. HP atau ID pesanan untuk melihat status pembayaran dan riwayat transaksi.",
  alternates: { canonical: "/topup/cek-status" },
  openGraph: {
    type: "website",
    url: "/topup/cek-status",
    title: "Cek Status Pesanan Top Up — KTD Store",
    description:
      "Cek status top up Anda secara live: masukkan No. HP atau ID pesanan.",
    images: [{ url: "/images/logo.png", width: 512, height: 512, alt: "KTD Store" }],
    siteName: "KTD Store",
    locale: "id_ID",
  },
  twitter: {
    card: "summary",
    title: "Cek Status Pesanan Top Up — KTD Store",
    description: "Cek status top up Anda secara live: masukkan No. HP atau ID pesanan.",
    images: ["/images/logo.png"],
  },
};

export default function CekStatusPage() {
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
        <Link href="/topup" className="transition-colors hover:text-brand">
          Top Up
        </Link>
        <span>/</span>
        <span className="text-muted">Cek Status</span>
      </nav>

      <CekStatus />
    </div>
  );
}
