import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PlpContent from "../../PlpContent";
import { getLocalImages } from "@/lib/localImages";
import { filterAndRankProducts, getCategoryBySlug } from "@/lib/produk-listing";
import { getStaticCategories, getStaticProducts } from "@/lib/products-cache";
import { SITE_URL } from "@/lib/config";
import { escapeJsonLd } from "@/lib/sanitize";

/** Semua kategori di-prerender saat build (sumber data statis JSON). */
export function generateStaticParams() {
  return getStaticCategories().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = getCategoryBySlug(slug);
  if (!cat) return { title: "Kategori Tidak Ditemukan" };
  const description = `Jelajahi koleksi produk ${cat.name} di KTD Store. Produk pilihan langsung dari supplier dengan harga terbaik.`;
  return {
    title: `Kategori ${cat.name}`,
    description,
    alternates: { canonical: `/produk/kategori/${cat.slug}` },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/produk/kategori/${cat.slug}`,
      title: `Kategori ${cat.name} — KTD Store`,
      description,
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
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const cat = getCategoryBySlug(slug);
  if (!cat) notFound();

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
    name: `Kategori ${cat.name} — KTD Store`,
    url: `${SITE_URL}/produk/kategori/${cat.slug}`,
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: escapeJsonLd(categoryJsonLd) }}
      />
      <div className="container-site pb-2 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          Kategori Produk
        </p>
        <h1 className="mt-1 text-xl font-bold text-ink sm:text-2xl">
          Produk {cat.name}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          Koleksi produk {cat.name} pilihan KTD Store — langsung dari supplier,
          pesan mudah dan aman via WhatsApp.
        </p>
      </div>
      <PlpContent
        categories={getStaticCategories()}
        products={paged}
        totalPages={Math.ceil(localized.length / PER_PAGE)}
        page={page}
        search=""
        category={slug}
        listingBase={`/produk/kategori/${slug}`}
      />
    </>
  );
}
