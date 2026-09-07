import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Headset,
  LifeBuoy,
  Mail,
  MessageCircle,
  ShoppingBag,
} from "lucide-react";
import { WHATSAPP_NUMBER } from "@/lib/config";

export const metadata: Metadata = {
  title: "Bantuan",
  description:
    "Pusat bantuan KTD Store: panduan belanja, konfirmasi pembayaran, FAQ, dan kontak Customer Service.",
  alternates: { canonical: "/bantuan" },
  openGraph: {
    type: "website",
    url: "/bantuan",
    title: "Pusat Bantuan — KTD Store",
    description:
      "Pusat bantuan KTD Store: panduan belanja, konfirmasi pembayaran, FAQ, dan kontak Customer Service.",
    images: [{ url: "/images/logo.png", width: 512, height: 512, alt: "KTD Store" }],
    siteName: "KTD Store",
    locale: "id_ID",
  },
  twitter: {
    card: "summary",
    title: "Pusat Bantuan — KTD Store",
    description:
      "Pusat bantuan KTD Store: panduan belanja, konfirmasi pembayaran, FAQ, dan kontak Customer Service.",
    images: ["/images/logo.png"],
  },
};

const TOPICS = [
  {
    icon: BookOpen,
    title: "Cara Belanja",
    desc: "Panduan langkah demi langkah belanja di KTD Store.",
    href: "/cara-belanja",
    cta: "Baca Panduan",
  },
  {
    icon: BadgeCheck,
    title: "Konfirmasi Pembayaran",
    desc: "Selesaikan pesanan Anda dengan mengirim bukti pembayaran.",
    href: "/konfirmasi-pembayaran",
    cta: "Konfirmasi Sekarang",
  },
  {
    icon: MessageCircle,
    title: "Chat WhatsApp",
    desc: "Tim CS siap membantu setiap hari 09:00–18:00 WIB.",
    href: `https://wa.me/${WHATSAPP_NUMBER}`,
    cta: "Mulai Chat",
  },
  {
    icon: Mail,
    title: "Email Kami",
    desc: "Pertanyaan lengkap? Kirim email ke support@ktdstore.com.",
    href: "mailto:support@ktdstore.com",
    cta: "Kirim Email",
  },
];

const FAQS = [
  {
    q: "Bagaimana cara melacak pesanan saya?",
    a: "Hubungi CS kami melalui WhatsApp dengan menyertakan nama dan detail pesanan Anda (produk yang dibeli, tanggal pemesanan, dan jumlah pembayaran), lalu kami akan mengirimkan informasi status serta nomor resi pengiriman Anda.",
  },
  {
    q: "Apakah produk bisa diretur atau ditukar?",
    a: "Pengembalian dan penukaran dapat diajukan melalui CS WhatsApp kami. Pastikan produk dalam kondisi asli beserta kemasannya, dan sertakan bukti pembelian.",
  },
  {
    q: "Bagaimana cara menjadi reseller atau dropshipper?",
    a: "Hubungi Customer Service kami melalui WhatsApp untuk informasi program reseller, harga khusus member, dan cara bergabung dengan supplier kami.",
  },
  {
    q: "Jam berapa Customer Service aktif?",
    a: "CS kami aktif setiap hari pukul 09:00–18:00 WIB, kecuali hari libur nasional. Pesan di luar jam tersebut akan kami balas pada hari kerja berikutnya.",
  },
  {
    q: "Metode pembayaran apa saja yang didukung?",
    a: "Pembayaran saat ini dilakukan sesuai arahan CS kami — transfer bank, e-wallet, atau QRIS. Detail pembayaran akan diinformasikan CS kami saat pemesanan.",
  },
];

export default function BantuanPage() {
  return (
    <div className="container-site py-5">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <span className="text-muted">Bantuan</span>
      </nav>

      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-brand via-brand to-[#c41f05] p-8 text-white shadow-lg sm:p-10">
        <h1 className="flex items-center gap-3 text-2xl font-extrabold sm:text-3xl">
          <LifeBuoy className="h-7 w-7" />
          Pusat Bantuan
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
          Ada pertanyaan atau kendala? Temukan jawabannya di sini, atau hubungi
          tim Customer Service kami yang siap membantu Anda.
        </p>
      </section>

      {/* Topics */}
      <section className="mt-8">
        <h2 className="text-xl font-bold text-ink sm:text-2xl">Mulai dari Sini</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {TOPICS.map((t) => {
            const external = t.href.startsWith("http") || t.href.startsWith("mailto");
            return (
              <a
                key={t.title}
                href={t.href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="group flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/5 text-brand">
                  <t.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-ink">{t.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.desc}</p>
                  <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-brand">
                    {t.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-ink sm:text-2xl">Pertanyaan yang Sering Diajukan</h2>
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
      <section className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-brand/15 bg-brand/5 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="flex items-center justify-center gap-2 text-lg font-bold text-ink sm:justify-start">
            <Headset className="h-5 w-5 text-brand" />
            Masih butuh bantuan?
          </h2>
          <p className="mt-1 text-sm text-muted">
            Tim kami siap membantu Anda setiap hari via WhatsApp dan email.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-2"
          >
            <MessageCircle className="h-4 w-4" />
            Chat WhatsApp
          </a>
          <Link
            href="/produk"
            className="flex items-center justify-center gap-2 rounded-xl border border-brand/30 bg-white px-6 py-3 text-sm font-bold text-brand shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand/5"
          >
            <ShoppingBag className="h-4 w-4" />
            Lanjut Belanja
          </Link>
        </div>
      </section>
    </div>
  );
}
