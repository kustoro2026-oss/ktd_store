// Detail produk: ambil info dasar dari static cache.
// Detail lengkap (deskripsi, varian) hanya tersedia saat script scrape manual dijalankan.
import type { AnekaProductDetail } from "./anekadropship";
import { getStaticProducts } from "./products-cache";

/** Field pengiriman hasil enrich (scripts/enrich-products-cache.cjs). */
type ShippingFields = {
  images?: string[];
  hargaModal?: string;
  terjual?: string;
  berat?: string;
  beratGram?: number | null;
  volume?: string;
  ekspedisi?: string;
  ekspedisiList?: string[];
  alamatSeller?: string;
};

/** Ambil detail produk dari static cache (info dasar + data pengiriman). */
export async function getDetailCached(id: string): Promise<AnekaProductDetail | null> {
  const products = getStaticProducts();
  const p = products.find((p) => p.id === id);
  if (!p) return null;

  // Info dasar + data pengiriman hasil enrich; deskripsi & varian tetap kosong.
  const s = p as ShippingFields;
  const beratGram =
    typeof s.beratGram === "number" && s.beratGram > 0 ? s.beratGram : null;

  return {
    id: p.id,
    name: p.name,
    images: s.images ?? [p.image].filter(Boolean),
    descriptionHtml: "",
    rekomendasiJual: p.rekomendasiJual ?? "Rp -",
    hargaModal: s.hargaModal ?? "",
    stok: p.stok ?? "0",
    terjual: s.terjual ?? "0",
    profit: "",
    sku: "",
    berat: s.berat ?? "",
    beratGram,
    volume: s.volume ?? "",
    ekspedisi: s.ekspedisi ?? "",
    ekspedisiList: s.ekspedisiList ?? [],
    sistem: "",
    alamatSeller: s.alamatSeller ?? "",
    location: p.location ?? "",
    hasVariants: false,
    variants: [],
    marketingKitUrl: null,
  };
}
