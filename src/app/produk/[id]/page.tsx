import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { Frown } from "lucide-react";
import ProductDetailView from "@/components/ProductDetailView";
import { getDetailCached } from "@/lib/detail-cache";
import type { AnekaProductDetail } from "@/lib/anekadropship";
import { SITE_URL } from "@/lib/config";
import { toLocalImages } from "@/lib/localImages";

// Never statically optimize — product data is scraped at request time.
export const dynamic = "force-dynamic";

// Dedupe the fetch between generateMetadata and the page body.
const getDetail = cache(async (id: string) => getDetailCached(id));

/** Strip HTML tags and collapse whitespace (for meta descriptions / JSON-LD). */
function plainText(html: string, max = 300): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

function priceValue(price: string): number | null {
  const digits = price.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

/** URL absolut untuk OG/Twitter/JSON-LD. */
function absoluteImages(images: string[]): string[] {
  return images.map((i) => (i.startsWith("http") ? i : `${SITE_URL}${i}`));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const detail = await getDetail(id);
    if (!detail?.name) return { title: "Produk Tidak Ditemukan" };
    const description =
      plainText(detail.descriptionHtml, 160) ||
      `Beli ${detail.name} di KTD Store. Pesan mudah dan aman via WhatsApp.`;
    // Gambar lokal (hasil sinkronisasi) agar OG/JSON-LD tidak hotlink eksternal.
    const localImages = toLocalImages(detail.id, detail.images);
    const ogImages = localImages.length
      ? absoluteImages(localImages)
      : [`${SITE_URL}/placeholder.svg`];
    return {
      title: detail.name,
      description,
      alternates: { canonical: `/produk/${detail.id}` },
      robots: { index: true, follow: true },
      openGraph: {
        type: "website",
        url: `${SITE_URL}/produk/${detail.id}`,
        title: detail.name,
        description,
        images: ogImages,
        siteName: "KTD Store",
        locale: "id_ID",
      },
      twitter: {
        card: "summary_large_image",
        title: detail.name,
        description,
        images: ogImages,
      },
    };
  } catch {
    return { title: "Produk Tidak Ditemukan" };
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let detail: AnekaProductDetail | null = null;
  let fetchError: string | null = null;
  try {
    detail = await getDetail(id);
    if (!detail?.name) {
      fetchError = "Produk tidak ditemukan. Mungkin sudah tidak tersedia.";
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Gagal memuat produk.";
  }

  if (!detail || fetchError) {
    return (
      <div className="container-site py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-muted-2">
          <Frown className="h-8 w-8" />
        </div>
        <p className="mt-4 text-lg font-semibold text-ink">Produk tidak ditemukan</p>
        <p className="mt-1 text-sm text-muted">{fetchError ?? "Coba lagi nanti."}</p>
        <Link
          href="/produk"
          className="mt-5 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2"
        >
          Kembali ke Produk
        </Link>
      </div>
    );
  }

  const price = priceValue(detail.rekomendasiJual);
  const description = plainText(detail.descriptionHtml, 500);
  // Gambar lokal untuk tampilan (cache bersama tidak boleh dimutasi).
  const localImages = toLocalImages(detail.id, detail.images);
  const viewDetail = { ...detail, images: localImages };
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: detail.name,
    sku: detail.id,
    image: localImages.length ? absoluteImages(localImages.slice(0, 3)) : undefined,
    description: description || undefined,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/produk/${detail.id}`,
      priceCurrency: "IDR",
      price: price ? String(price) : undefined,
      availability:
        Number(String(detail.stok).replace(/\D/g, "") || "0") > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Produk", item: `${SITE_URL}/produk` },
      {
        "@type": "ListItem",
        position: 3,
        name: detail.name,
        item: `${SITE_URL}/produk/${detail.id}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ProductDetailView detail={viewDetail} />
    </>
  );
}
