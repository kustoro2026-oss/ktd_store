import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ReceiptText, ShieldCheck, Wallet } from "lucide-react";
import PaymentConfirmForm from "@/components/PaymentConfirmForm";

export const metadata: Metadata = {
  title: "Konfirmasi Pembayaran",
  description:
    "Konfirmasi pembayaran pesanan Anda di KTD Store melalui WhatsApp dengan cepat dan mudah.",
  alternates: { canonical: "/konfirmasi-pembayaran" },
  openGraph: {
    type: "website",
    url: "/konfirmasi-pembayaran",
    title: "Konfirmasi Pembayaran — KTD Store",
    description:
      "Konfirmasi pembayaran pesanan Anda di KTD Store melalui WhatsApp dengan cepat dan mudah.",
    images: [{ url: "/images/logo.png", width: 512, height: 512, alt: "KTD Store" }],
    siteName: "KTD Store",
    locale: "id_ID",
  },
  twitter: {
    card: "summary",
    title: "Konfirmasi Pembayaran — KTD Store",
    description:
      "Konfirmasi pembayaran pesanan Anda di KTD Store melalui WhatsApp dengan cepat dan mudah.",
    images: ["/images/logo.png"],
  },
};

const INFO = [
  {
    icon: Wallet,
    title: "Siapkan Bukti Transfer",
    desc: "Screenshot atau simpan bukti transfer dari aplikasi bank / e-wallet Anda.",
  },
  {
    icon: ReceiptText,
    title: "Isi Data Pesanan",
    desc: "Lengkapi nama, nomor pesanan, metode pembayaran, dan jumlah yang dibayar.",
  },
  {
    icon: ShieldCheck,
    title: "Kirim via WhatsApp",
    desc: "Form ini membuka WhatsApp dengan pesan terisi otomatis. Lampirkan bukti transfer lalu kirim.",
  },
];

export default function KonfirmasiPembayaranPage() {
  return (
    <div className="container-site py-5">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <span className="text-muted">Konfirmasi Pembayaran</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <section>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Konfirmasi Pembayaran</h1>
          <p className="mt-2 text-sm text-muted">
            Isi formulir di bawah ini, lalu kirimkan bersama bukti transfer melalui
            WhatsApp agar pesanan Anda segera diproses.
          </p>

          <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
            <PaymentConfirmForm />
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-ink">Langkah Konfirmasi</h2>
            <div className="mt-4 space-y-4">
              {INFO.map((it, i) => (
                <div key={it.title} className="flex gap-3">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/5 text-brand">
                    <it.icon className="h-4.5 w-4.5" />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{it.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{it.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              <p className="text-xs leading-relaxed text-amber-800">
                Jangan lupa lampirkan bukti transfer di chat WhatsApp. Konfirmasi
                tanpa bukti transfer tidak dapat diproses.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-ink">Belum tahu cara belanja?</h2>
            <p className="mt-1 text-xs text-muted">
              Pelajari alur belanja dari mencari produk sampai pembayaran.
            </p>
            <Link
              href="/cara-belanja"
              className="mt-3 inline-block rounded-xl border border-brand/20 bg-brand/5 px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
            >
              Lihat Cara Belanja →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
