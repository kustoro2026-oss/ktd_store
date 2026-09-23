// Cache deskripsi produk — hasil scripts/enrich-descriptions-cache.ts (sweep
// halaman detail anekadropship). Nilai sudah dibersihkan + diformat pipeline
// situs (cleanDescription → formatDescription): junk internal dibuang, heading
// section beremoji, list/tabel rapi. Disimpan sebagai HTML siap render.
import descriptionCache from "./description-cache.json";

type DescriptionCacheFile = {
  generatedAt: string | null;
  scanned: number;
  withDescription: number;
  empty: number;
  totalChars: number;
  products: Record<string, string>;
};

const FILE = descriptionCache as DescriptionCacheFile;

/** Deskripsi HTML satu produk (null jika belum discan / kosong). */
export function getCachedDescription(id: string): string | null {
  const html = FILE.products[id];
  return html && html.length > 0 ? html : null;
}

/** Metadata file cache deskripsi (untuk audit/verifikasi). */
export function getDescriptionCacheMeta() {
  return {
    generatedAt: FILE.generatedAt,
    scanned: FILE.scanned,
    withDescription: FILE.withDescription,
    empty: FILE.empty,
    totalChars: FILE.totalChars,
  };
}
