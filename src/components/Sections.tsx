import Link from "next/link";
import { Home, PawPrint, Sparkles, SprayCan, type LucideIcon } from "lucide-react";
import { blogPosts, collections, type IconKey } from "@/lib/data";

const ICONS: Partial<Record<IconKey, LucideIcon>> = {
  spray: SprayCan,
  paw: PawPrint,
  sparkles: Sparkles,
  home: Home,
};

/* 6. Koleksi Terkini */
export function LatestCollections() {
  return (
    <section className="container-site mt-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink sm:text-2xl">Koleksi Terkini</h2>
          <p className="mt-1 text-sm text-muted">Temukan produk yang sedang diminati</p>
        </div>
        <Link href="/produk" className="whitespace-nowrap text-sm font-semibold text-brand hover:underline">
          Lihat Semua →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {collections.map((c) => {
          const Icon = ICONS[c.icon] ?? Sparkles;
          return (
            <Link
              key={c.title}
              href={`/produk?search=${encodeURIComponent(c.query)}`}
              className="group flex h-32 flex-col items-center justify-center gap-3 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-orange-50/60 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand shadow-sm transition-transform group-hover:scale-110">
                <Icon className="h-7 w-7" />
              </span>
              <span className="px-3 text-sm font-semibold text-ink">{c.title}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* 7. Info Terbaru (blog) */
export function BlogSection() {
  return (
    <section id="info-tips" className="container-site mt-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink sm:text-2xl">Info &amp; Tips</h2>
          <p className="mt-1 text-sm text-muted">Artikel bermanfaat untuk belanja cerdas</p>
        </div>
        <Link
          href="/tips"
          className="shrink-0 text-sm font-semibold text-brand transition-colors hover:underline"
        >
          Lihat Semua →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {blogPosts.map((b) => (
          <Link
            key={b.slug}
            href={`/tips/${b.slug}`}
            className="group flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={b.image}
              alt={b.title}
              loading="lazy"
              className="h-16 w-16 shrink-0 rounded-xl border border-gray-100 object-cover"
            />
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold text-ink transition-colors group-hover:text-brand">
                {b.title}
              </p>
              <p className="mt-1 text-xs text-muted-2">{b.date}</p>
              <p className="mt-1.5 text-xs font-semibold text-brand opacity-0 transition-opacity group-hover:opacity-100">
                Baca artikel →
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* 8. SEO text block */
export function SeoText() {
  return (
    <section className="container-site mt-12">
      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-6 sm:p-8">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">
          KTD Store — Belanja Online Produk Pilihan
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Belanja kebutuhan Anda dengan mudah, aman, dan nyaman. Kami menyediakan
          berbagai kategori produk pilihan mulai dari kesehatan, kecantikan,
          elektronik, fashion, peralatan rumah tangga, hingga kebutuhan hewan
          peliharaan dan pertanian — semua dengan harga bersaing.
        </p>
        <p className="mt-3 text-sm leading-6 text-muted">
          Temukan produk favorit Anda dari berbagai kategori pilihan. Setiap
          produk dilengkapi deskripsi lengkap dan dapat dipesan dengan mudah
          melalui WhatsApp.
        </p>
      </div>
    </section>
  );
}
