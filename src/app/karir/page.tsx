import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Home, Sparkles, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Karir",
  description:
    "Kenali budaya kerja di KTD Store. Saat ini belum ada lowongan, pantau halaman ini untuk kesempatan berikutnya.",
  alternates: { canonical: "/karir" },
  openGraph: {
    type: "website",
    url: "/karir",
    title: "Karir — KTD Store",
    description:
      "Kenali budaya kerja di KTD Store. Saat ini belum ada lowongan, pantau halaman ini untuk kesempatan berikutnya.",
    images: [{ url: "/images/logo.png", width: 512, height: 512, alt: "KTD Store" }],
    siteName: "KTD Store",
    locale: "id_ID",
  },
  twitter: {
    card: "summary",
    title: "Karir — KTD Store",
    description:
      "Kenali budaya kerja di KTD Store. Saat ini belum ada lowongan, pantau halaman ini untuk kesempatan berikutnya.",
    images: ["/images/logo.png"],
  },
};

const PERKS = [
  {
    icon: Home,
    title: "Fleksibel & Remote",
    desc: "Bekerja dari mana saja dengan jam kerja yang fleksibel selama target tercapai.",
  },
  {
    icon: Users,
    title: "Tim Solid",
    desc: "Lingkungan kerja yang suportif, kolaboratif, dan saling membantu antar tim.",
  },
  {
    icon: Sparkles,
    title: "Berkembang Bersama",
    desc: "Kesempatan belajar dan berkembang seiring pertumbuhan perusahaan yang pesat.",
  },
];

export default function KarirPage() {
  return (
    <div className="container-site py-5">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <span className="text-muted">Karir</span>
      </nav>

      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-brand via-brand to-[#c41f05] p-8 text-white shadow-lg sm:p-10">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Bergabung dengan KTD Store</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
          Tertarik bergabung dengan KTD Store? Kenali budaya kerja kami di sini
          dan pantau halaman ini untuk info lowongan di masa mendatang.
        </p>
      </section>

      {/* Perks */}
      <section className="mt-8">
        <h2 className="text-xl font-bold text-ink sm:text-2xl">Kenapa KTD Store?</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {PERKS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/5 text-brand">
                <p.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-bold text-ink">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* No openings */}
      <section className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-brand/15 bg-brand/5 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="flex items-center justify-center gap-2 text-lg font-bold text-ink sm:justify-start">
            <Briefcase className="h-5 w-5 text-brand" />
            Belum Ada Lowongan
          </h2>
          <p className="mt-1 text-sm text-muted">
            Saat ini KTD Store belum membuka lowongan kerja. Pantau halaman ini
            atau media sosial kami untuk kesempatan berikutnya.
          </p>
        </div>
        <Link
          href="/tentang-kami"
          className="shrink-0 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-2"
        >
          Kenali Kami Lebih Jauh
        </Link>
      </section>
    </div>
  );
}
