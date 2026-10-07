// Path logo lokal brand top-up (dari src/lib/topup-images.json).
// Peta dihasilkan oleh unduhan logo Wikimedia; slug tanpa logo = "" (UI
// menampilkan fallback inisial berwarna).
import mapping from "./topup-images.json";

const IMAGES: Record<string, string> = mapping;

/** Path logo lokal provider, atau "" bila tidak ada (fallback inisial). */
export function providerImage(slug: string): string {
  return IMAGES[slug] ?? "";
}
