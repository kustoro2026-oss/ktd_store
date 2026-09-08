// Mapping gambar produk lokal: id produk -> path relatif di /public.
// Dihasilkan oleh POST /api/admin/sync-images (lihat route tersebut).
// Jika produk belum tersinkron, fallback ke URL asli dari anekadropship.
import mapping from "./product-images.json";

const PRODUCT_IMAGES: Record<string, string[]> = mapping;

/** Daftar gambar lokal untuk sebuah produk (kosong bila belum tersinkron). */
export function getLocalImages(id: string): string[] {
  return PRODUCT_IMAGES[id] ?? [];
}

/** Gambar lokal bila tersedia; jika tidak, kembalikan URL asli. */
export function toLocalImages(id: string, fallback: string[]): string[] {
  const local = getLocalImages(id);
  return local.length ? local : fallback;
}
