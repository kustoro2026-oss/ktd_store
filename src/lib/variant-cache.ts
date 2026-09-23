// Cache varian produk — hasil scripts/enrich-variants-cache.cjs (sweep halaman
// detail anekadropship). Hanya varian yang disimpan; harga modal per varian
// SENGAJA tidak disimpan karena tidak pernah ditampilkan ke pembeli
// (harga tampil selalu rekomendasiJual / "Harga Jual").
import variantCache from "./variant-cache.json";

/** Satu varian hasil scrape (bentuk tampilan, tanpa harga modal). */
export type CachedVariant = {
  id: string;
  /** Label supplier lengkap (mis. "S 10 NEW / Hitam / 39"). */
  name: string;
  /** Nilai axis warna (null jika supplier tidak memisahkan). */
  color: string | null;
  /** Nilai axis ukuran (null jika supplier tidak memisahkan). */
  size: string | null;
  /** Stok varian. */
  stock: number;
  /** Apakah varian aktif dijual. */
  isActive: boolean;
};

export type CachedVariantEntry = {
  hasVariants: boolean;
  variants: CachedVariant[];
};

type VariantCacheFile = {
  generatedAt: string | null;
  scanned: number;
  withVariants: number;
  totalVariants: number;
  products: Record<string, CachedVariantEntry>;
};

const FILE = variantCache as VariantCacheFile;

/** Varian cache satu produk (null jika produk belum pernah discan). */
export function getCachedVariants(id: string): CachedVariantEntry | null {
  return FILE.products[id] ?? null;
}

/** Metadata file cache varian (untuk audit/verifikasi). */
export function getVariantCacheMeta() {
  return {
    generatedAt: FILE.generatedAt,
    scanned: FILE.scanned,
    withVariants: FILE.withVariants,
    totalVariants: FILE.totalVariants,
  };
}
