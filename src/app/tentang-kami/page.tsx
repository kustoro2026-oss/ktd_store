import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Handshake,
  MessageCircle,
  ShieldCheck,
  Tags,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Tentang Kami",
  description:
    "Kenali KTD Store: platform belanja online dengan produk pilihan langsung dari supplier dan transaksi aman via WhatsApp.",
};

const VALUES = [
  {
    icon: Tags,
    title: "Harga Bersaing",
    desc: "Harga rekomendasi jual yang kompetitif karena produk diambil langsung dari supplier, tanpa perantara yang tidak perlu.",
  },
  {
    icon: BadgeCheck,
    title: "Produk Kurasi",
    desc: "Setiap produk ditampilkan dengan info lengkap: deskripsi jelas, info stok tercantum, dan riwayat penjualan yang terlihat.",
  },
  {
    icon: ShieldCheck,
    title: "Transaksi Aman",
    desc: "Pembelian saat ini dilakukan melalui WhatsApp, sehingga Anda terlindungi dari awal sampai pesanan tiba.",
  },
  {
    icon: MessageCircle,
    title: "CS Siap Membantu",
    desc: "Tim Customer Service siap membantu setiap hari via WhatsApp dan email, dari sebelum pesan sampai pesanan tiba.",
  },
];

const STATS = [
  { value: "WhatsApp", label: "Pemesanan Mudah" },
  { value: "29", label: "Kategori Produk" },
  { value: "7 Hari", label: "CS Aktif" },
  { value: "09–18", label: "Jam Layanan CS (WIB)" },
];

export default function TentangKamiPage() {
  return (
    <div className="container-site py-5">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <span className="text-muted">Tentang Kami</span>
      </nav>

      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-brand via-brand to-[#c41f05] p-8 text-white shadow-lg sm:p-10">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Tentang KTD Store</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
          KTD Store adalah toko online yang menghubungkan Anda langsung
          dengan produk pilihan dari supplier di Indonesia.
        </p>
      </section>

      {/* Story */}
      <section className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-bold text-ink sm:text-2xl">Cerita Kami</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            KTD Store berawal dari keyakinan sederhana: belanja online yang baik
            adalah belanja yang aman, transparan, dan menguntungkan semua pihak.
            Kami menampilkan produk pilihan dari supplier yang terkurasi,
            dengan harga bersaing, info stok tercantum, dan deskripsi yang
            jelas.
          </p>
          <p className="mt-3 text-sm leading-7 text-muted">
            Semua transaksi saat ini dilakukan melalui pemesanan via WhatsApp —
            marketplace resmi segera menyusul. Dengan begitu, setiap pembelian
            Anda terlindungi, dan pengiriman ditangani kurir profesional.
          </p>
          <p className="mt-3 text-sm leading-7 text-muted">
            Visi kami sederhana: menjadi tempat belanja online terpercaya dengan
            pengalaman terbaik, dari pencarian produk sampai pesanan tiba di
            tangan Anda.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm"
            >
              <p className="text-3xl font-extrabold text-brand">{s.value}</p>
              <p className="mt-1 text-xs font-medium text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-ink sm:text-2xl">Kenapa Belanja di KTD Store?</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div
              key={v.title}
              className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/5 text-brand">
                <v.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-bold text-ink">{v.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-brand/15 bg-brand/5 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="text-lg font-bold text-ink">Mari berbelanja bersama kami</h2>
          <p className="mt-1 text-sm text-muted">
            Jelajahi katalog produk pilihan atau hubungi kami jika ada pertanyaan.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link
            href="/produk"
            className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-2"
          >
            Jelajahi Produk
          </Link>
          <Link
            href="/bantuan"
            className="flex items-center justify-center gap-2 rounded-xl border border-brand/30 bg-white px-6 py-3 text-sm font-bold text-brand shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand/5"
          >
            <Handshake className="h-4 w-4" />
            Hubungi Kami
          </Link>
        </div>
      </section>
    </div>
  );
}
