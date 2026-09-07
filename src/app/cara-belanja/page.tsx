import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  CreditCard,
  MessageCircle,
  Search,
  ShoppingCart,
  Store,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Cara Belanja",
  description:
    "Panduan lengkap cara belanja di KTD Store: cari produk, pesan via WhatsApp, sampai konfirmasi pembayaran.",
  alternates: { canonical: "/cara-belanja" },
  openGraph: {
    type: "website",
    url: "/cara-belanja",
    title: "Cara Belanja di KTD Store",
    description:
      "Panduan lengkap cara belanja di KTD Store: cari produk, pesan via WhatsApp, sampai konfirmasi pembayaran.",
    images: [{ url: "/images/logo.png", width: 512, height: 512, alt: "KTD Store" }],
    siteName: "KTD Store",
    locale: "id_ID",
  },
  twitter: {
    card: "summary",
    title: "Cara Belanja di KTD Store",
    description:
      "Panduan lengkap cara belanja di KTD Store: cari produk, pesan via WhatsApp, sampai konfirmasi pembayaran.",
    images: ["/images/logo.png"],
  },
};

const STEPS = [
  {
    icon: Search,
    title: "Cari Produk",
    desc: "Gunakan kolom pencarian atau jelajahi kategori untuk menemukan produk yang Anda butuhkan. Produk kami diambil langsung dari supplier pilihan.",
  },
  {
    icon: ShoppingCart,
    title: "Pilih & Cek Detail",
    desc: "Buka halaman produk untuk melihat foto, deskripsi, harga rekomendasi jual, dan estimasi profit jika Anda ingin dropship.",
  },
  {
    icon: Store,
    title: "Pesan via WhatsApp",
    desc: "Klik tombol Pesan via WhatsApp pada produk, isi data penerima, dan pesanan langsung terkirim ke WhatsApp kami.",
  },
  {
    icon: CreditCard,
    title: "Selesaikan Pembayaran",
    desc: "Selesaikan pembayaran sesuai metode yang disepakati bersama CS, lalu simpan bukti pembayarannya.",
  },
  {
    icon: BadgeCheck,
    title: "Konfirmasi Pembayaran",
    desc: "Kirim konfirmasi pembayaran melalui halaman Konfirmasi Pembayaran agar pesanan Anda segera diproses.",
  },
];

const FAQS = [
  {
    q: "Apakah saya bisa membeli langsung di website ini?",
    a: "Pembayaran dan pembelian saat ini dilakukan melalui pemesanan via WhatsApp agar transaksi Anda aman. Marketplace resmi (Shopee, TikTok Shop, Lazada) akan segera menyusul.",
  },
  {
    q: "Apakah ada biaya tambahan?",
    a: "Harga yang tertera adalah rekomendasi harga jual. Harga modal khusus member ditampilkan setelah Anda bergabung sebagai reseller/dropshipper supplier.",
  },
  {
    q: "Berapa lama pesanan diproses?",
    a: "Pesanan diproses setelah pembayaran terkonfirmasi. Estimasi pengiriman mengikuti kurir yang dipilih.",
  },
  {
    q: "Bagaimana jika saya ingin menjadi reseller?",
    a: "Hubungi Customer Service kami melalui WhatsApp untuk informasi lebih lanjut tentang program reseller dan harga khusus member.",
  },
];

export default function CaraBelanjaPage() {
  return (
    <div className="container-site py-5">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <span className="text-muted">Cara Belanja</span>
      </nav>

      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-brand via-brand to-[#c41f05] p-8 text-white shadow-lg sm:p-10">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Cara Belanja di KTD Store</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
          Belanja di KTD Store mudah dan aman — cukup lima langkah. Semua
          transaksi saat ini dilakukan melalui WhatsApp, jadi Anda terlindungi
          dari awal sampai pesanan tiba.
        </p>
      </section>

      {/* Steps */}
      <section className="mt-8">
        <h2 className="text-xl font-bold text-ink sm:text-2xl">Langkah Belanja</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="absolute right-4 top-4 text-4xl font-extrabold text-brand/10">
                {i + 1}
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/5 text-brand">
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-bold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.desc}</p>
            </div>
          ))}
          <div className="flex flex-col items-start justify-center rounded-2xl border-2 border-dashed border-brand/30 bg-brand/5 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white">
              <MessageCircle className="h-5 w-5" />
            </span>
            <h3 className="mt-3 font-bold text-ink">Butuh Bantuan?</h3>
            <p className="mt-1.5 text-sm text-muted">
              Customer Service kami siap membantu setiap hari via WhatsApp.
            </p>
            <Link
              href="/konfirmasi-pembayaran"
              className="mt-3 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-2"
            >
              Konfirmasi Pembayaran
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-ink sm:text-2xl">Pertanyaan Umum</h2>
        <div className="mt-4 space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-xl border border-gray-100 bg-white p-5 shadow-sm open:border-brand/30"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-ink">
                {f.q}
                <span className="text-brand transition-transform group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="text-lg font-bold text-ink">Siap mulai belanja?</h2>
          <p className="mt-1 text-sm text-muted">
            Jelajahi berbagai produk dari supplier pilihan.
          </p>
        </div>
        <Link
          href="/produk"
          className="shrink-0 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-2"
        >
          Lihat Semua Produk
        </Link>
      </section>
    </div>
  );
}
