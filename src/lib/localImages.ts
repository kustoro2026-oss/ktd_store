// Mapping gambar produk lokal: id produk -> path relatif di /public.
// Aneka: POST /api/admin/sync-images. Evermos (EVM-): evermos-images.json,
// hasil scripts/download-evermos-covers.cjs.
// Jika produk belum tersinkron, fallback ke URL asli dari anekadropship.
import mapping from "./product-images.json";
import evermosMapping from "./evermos-images.json";

const PRODUCT_IMAGES: Record<string, string[]> = mapping;
const EVERMOS_IMAGES: Record<string, string[]> = evermosMapping;

/** Daftar gambar lokal untuk sebuah produk (kosong bila belum tersinkron). */
export function getLocalImages(id: string): string[] {
  if (id.startsWith("EVM-")) return EVERMOS_IMAGES[id] ?? [];
  return PRODUCT_IMAGES[id] ?? [];
}

/** Gambar lokal bila tersedia; jika tidak, kembalikan URL asli. */
export function toLocalImages(id: string, fallback: string[]): string[] {
  const local = getLocalImages(id);
  return local.length ? local : fallback;
}
