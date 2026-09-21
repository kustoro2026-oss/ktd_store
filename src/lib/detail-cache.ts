// Detail produk: ambil info dasar dari static cache.
// Detail lengkap (deskripsi, varian) hanya tersedia saat script scrape manual dijalankan.
import type { AnekaProductDetail } from "./anekadropship";
import { getStaticProducts } from "./products-cache";

/** Ambil detail produk dari static cache (info dasar saja). */
export async function getDetailCached(id: string): Promise<AnekaProductDetail | null> {
  const products = getStaticProducts();
  const p = products.find((p) => p.id === id);
  if (!p) return null;

  // Return basic info as AnekaProductDetail shape.
  // Full details (description, variants, images) will be empty.
  return {
    id: p.id,
    name: p.name,
    images: (p as { images?: string[] }).images ?? [p.image].filter(Boolean),
    descriptionHtml: "",
    rekomendasiJual: p.rekomendasiJual ?? "Rp -",
    hargaModal: (p as { hargaModal?: string }).hargaModal ?? "",
    stok: p.stok ?? "0",
    terjual: (p as { terjual?: string }).terjual ?? "0",
    profit: "",
    sku: "",
    berat: "",
    beratGram: null,
    volume: "",
    ekspedisi: "",
    ekspedisiList: [],
    sistem: "",
    alamatSeller: "",
    hasVariants: false,
    variants: [],
    marketingKitUrl: null,
  };
}
