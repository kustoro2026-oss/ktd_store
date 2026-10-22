import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlpContent from "../../PlpContent";
import { getLocalImages } from "@/lib/localImages";
import { filterAndRankProducts, getCategoryBySlug } from "@/lib/produk-listing";
import { getStaticCategories, getStaticProducts } from "@/lib/products-cache";
import { muatHargaKtd } from "@/lib/ktd-store-harga";
import { SITE_URL } from "@/lib/config";
import { escapeJsonLd } from "@/lib/sanitize";

/** Kategori di-prerender saat build; harga override KTD Store di-refresh via ISR. */
export const revalidate = 300;

/** Semua kategori di-prerender saat build (sumber data statis JSON). */
export function generateStaticParams() {
  return getStaticCategories().map((c) => ({ slug: c.slug }));
}

/** Slug dari params bisa datang ter-encode (%20) atau sudah ter-decode —
 *  perilaku Next 16 berbeda antara generateMetadata dan komponen halaman. */
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const cat = getCategoryBySlug(slug);
  if (!cat) return { title: "Kategori Tidak Ditemukan" };
  const description = `Beli ${cat.name} murah dan terlengkap di KTD Store. Harga bersaing langsung dari supplier, pesan mudah dan aman via WhatsApp.`;
  // Gambar OG: produk pertama kategori (bila ada), fallback ke logo.
  const first = filterAndRankProducts(getStaticProducts(), "", cat.slug)[0];
  const firstLocal = first ? getLocalImages(first.id) : [];
  const ogImage = firstLocal[0] ?? "/images/logo.png";
  const ogUrl = ogImage.startsWith("http") ? ogImage : `${SITE_URL}${ogImage}`;
  return {
    title: `${cat.name} — Beli Online Harga Murah | KTD Store`,
    description,
    alternates: { canonical: `/produk/kategori/${encodeURIComponent(cat.slug)}` },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/produk/kategori/${encodeURIComponent(cat.slug)}`,
      title: `${cat.name} — Beli Online Harga Murah | KTD Store`,
      description,
      images: [{ url: ogUrl, width: 800, height: 800, alt: cat.name }],
      siteName: "KTD Store",
      locale: "id_ID",
    },
  };
}

const PER_PAGE = 20;

export default async function KategoriProdukPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug: rawSlug } = await params;
  const { page: pageParam } = await searchParams;
  const slug = decodeSlug(rawSlug);
  const cat = getCategoryBySlug(slug);
  if (!cat) notFound();

  // Harga override KTD Store (±5 menit cache) — dipakai getStaticProducts di bawah.
  await muatHargaKtd();

  const page = Math.max(1, Number(pageParam ?? "1"));

  const ranked = filterAndRankProducts(getStaticProducts(), "", slug);
  const localized = ranked.map((p) => {
    const local = getLocalImages(p.id);
    return local.length ? { ...p, image: local[0] } : p;
  });
  const start = (page - 1) * PER_PAGE;
  const paged = localized.slice(start, start + PER_PAGE);

  // Kaya data terstruktur agar halaman kategori terbaca Google:
  // CollectionPage + daftar URL produk halaman ini.
  const categoryJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${cat.name} — Beli Online Harga Murah | KTD Store`,
    url: `${SITE_URL}/produk/kategori/${encodeURIComponent(cat.slug)}`,
    description: `Koleksi produk kategori ${cat.name} di KTD Store.`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: paged.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/produk/${p.id}`,
      })),
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
        name: cat.name,
        item: `${SITE_URL}/produk/kategori/${encodeURIComponent(cat.slug)}`,
      },
    ],
  };

  // Kategori lain yang saling tertaut (internal link, urutan deterministik).
  const allCats = getStaticCategories();
  const idx = allCats.findIndex((c) => c.slug === cat.slug);
  const relatedCats = Array.from({ length: 6 }, (_, i) => allCats[(idx + 1 + i) % allCats.length]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: escapeJsonLd(categoryJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: escapeJsonLd(breadcrumbJsonLd) }}
      />
      <div className="container-site pb-2 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          Kategori Produk
        </p>
        <h1 className="mt-1 text-xl font-bold text-ink sm:text-2xl">
          Produk {cat.name}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          Beli {cat.name} murah di KTD Store — koleksi produk {cat.name} pilihan
          langsung dari supplier. Harga bersaing, info stok tercantum, pesan
          mudah dan aman via WhatsApp.
        </p>
      </div>
      <PlpContent
        categories={getStaticCategories()}
        products={paged}
        totalPages={Math.ceil(localized.length / PER_PAGE)}
        page={page}
        search=""
        category={cat.slug}
        listingBase={`/produk/kategori/${encodeURIComponent(cat.slug)}`}
      />

      {/* Teks SEO: kedalaman konten + internal link ke kategori lain */}
      <section className="container-site pb-10 pt-2">
        <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-6 sm:p-8">
          <h2 className="text-lg font-bold text-ink sm:text-xl">
            Beli {cat.name} Murah di KTD Store
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Cari {cat.name} berkualitas dengan harga bersaing? KTD Store
            menyediakan berbagai pilihan produk {cat.name.toLowerCase()}{" "}
            langsung dari supplier terpercaya di Indonesia. Setiap produk
            dilengkapi deskripsi jelas, info stok tercantum, dan riwayat
            penjualan yang bisa Anda cek sebelum membeli.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted">
            Pembayaran online dilakukan dengan memindai kode QRIS dari aplikasi
            e-wallet atau m-banking apa pun, dan pesanan dikirim dengan kurir
            ekspedisi terpercaya ke seluruh Indonesia. Pilih produk favorit
            Anda, tentukan varian, lalu selesaikan pemesanan dengan mudah via
            WhatsApp.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted">
            Kategori lainnya di KTD Store:{" "}
            {relatedCats.map((c, i) => (
              <span key={c.slug}>
                {i > 0 && ", "}
                <Link
                  href={`/produk/kategori/${encodeURIComponent(c.slug)}`}
                  className="font-medium text-brand hover:underline"
                >
                  {c.name}
                </Link>
              </span>
            ))}
            .
          </p>
        </div>
      </section>
    </>
  );
}
