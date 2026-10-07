import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRupiah, providerBySlug } from "@/lib/topup";
import NominalPicker from "@/components/topup/NominalPicker";

type Props = {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{ sku?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { provider } = await params;
  const p = providerBySlug(provider);
  if (!p) {
    return { title: "Provider Tidak Ditemukan — KTD Store" };
  }
  const min = Math.min(...p.nominals.map((n) => n.sellPrice));
  const title = `Top Up ${p.label} — Mulai ${formatRupiah(min)} | KTD Store`;
  const description = `Top up ${p.label} murah, cepat, dan otomatis di KTD Store. Bayar via QRIS atau Virtual Account — saldo masuk otomatis setelah pembayaran terverifikasi.`;
  return {
    title,
    description,
    alternates: { canonical: `/topup/${p.slug}` },
    openGraph: {
      type: "website",
      url: `/topup/${p.slug}`,
      title,
      description,
      images: [{ url: "/images/logo.png", width: 512, height: 512, alt: "KTD Store" }],
      siteName: "KTD Store",
      locale: "id_ID",
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/images/logo.png"],
    },
  };
}

export default async function ProviderPage({ params, searchParams }: Props) {
  const { provider } = await params;
  const { sku } = await searchParams;
  const p = providerBySlug(provider);
  if (!p) notFound();

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
        <span className="text-muted">{p.label}</span>
      </nav>

      <NominalPicker provider={p} initialSku={typeof sku === "string" ? sku : undefined} />
    </div>
  );
}
