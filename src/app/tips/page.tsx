import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Search } from "lucide-react";
import { blogPosts } from "@/lib/data";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Artikel, tips, dan informasi bermanfaat seputar belanja cerdas di KTD Store.",
  alternates: { canonical: "/tips" },
  openGraph: {
    type: "website",
    url: "/tips",
    title: "Blog KTD Store — Tips & Info Belanja Cerdas",
    description:
      "Artikel, tips, dan informasi bermanfaat seputar belanja cerdas di KTD Store.",
    images: [{ url: "/images/blog/pembersih.jpg", alt: "Blog KTD Store" }],
    siteName: "KTD Store",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog KTD Store — Tips & Info Belanja Cerdas",
    description:
      "Artikel, tips, dan informasi bermanfaat seputar belanja cerdas di KTD Store.",
    images: ["/images/blog/pembersih.jpg"],
  },
};

export default function BlogPage() {
  return (
    <div className="container-site py-5">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <span className="text-muted">Blog</span>
      </nav>

      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-brand via-brand to-[#c41f05] p-8 text-white shadow-lg sm:p-10">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Blog &amp; Info Tips</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
          Artikel dan tips bermanfaat agar belanja Anda semakin cerdas —
          mulai dari memilih produk hingga merawatnya di rumah.
        </p>
      </section>

      {/* Article grid */}
      <section className="mt-8">
        <h2 className="text-xl font-bold text-ink sm:text-2xl">Artikel Terbaru</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {blogPosts.map((b) => (
            <Link
              key={b.slug}
              href={`/tips/${b.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.image}
                alt={b.title}
                loading="lazy"
                className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="flex flex-1 flex-col p-5">
                <p className="flex items-center gap-1.5 text-xs text-muted-2">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {b.date}
                </p>
                <h3 className="mt-2 line-clamp-2 font-bold leading-snug text-ink transition-colors group-hover:text-brand">
                  {b.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
                  {b.excerpt}
                </p>
                <p className="mt-3 text-sm font-semibold text-brand">
                  Baca artikel →
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="text-lg font-bold text-ink">Cari inspirasi produk?</h2>
          <p className="mt-1 text-sm text-muted">
            Temukan produk pilihan langsung dari supplier.
          </p>
        </div>
        <Link
          href="/produk"
          className="flex shrink-0 items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-2"
        >
          <Search className="h-4 w-4" />
          Jelajahi Produk
        </Link>
      </section>
    </div>
  );
}
