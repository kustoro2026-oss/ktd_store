// Pemetaan nama produk -> link Tokopedia/TikTok Shop.
// Sumber data: tokopedia-products.json (hasil scrape Seller Center).
// Tokopedia & TikTok Shop sudah merger (ShopTokopedia), jadi link ini
// dipakai untuk tombol marketplace "TikTok Shop" di halaman produk & keranjang.

import tokopediaProducts from "../../tokopedia-products.json";

type TokopediaProductEntry = {
  id: string;
  name: string;
  url: string;
  price?: string;
  stock?: number;
};

const SOURCE = tokopediaProducts as TokopediaProductEntry[];

/** Lowercase, buang tanda baca, satukan spasi. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const byName = new Map<string, string>();
for (const p of SOURCE) {
  const key = normalize(p.name);
  if (key && !byName.has(key)) byName.set(key, p.url);
}

const KEYS = [...byName.keys()];

/**
 * Alias manual: nama produk di anekadropship (live) yang susunan katanya
 * berbeda dari nama di tokopedia-products.json, tapi produknya sama.
 * Key = nama live hasil normalize(); value = url produk.
 */
const ALIASES: Record<string, string> = {
  // "Sari Lemon Detoks California 250ml - Jus Perasan Lemon Murni Asli Berkualitas"
  "sari lemon original 250ml diet detoks original california":
    "https://shop-id.tokopedia.com/view/product/1737454037802976816?region=ID&locale=id-ID",
  // "Sari Lemon California Murni 500ml - Perasan Lemon Asli Segar Tanpa Pengawet"
  "sari lemon 500ml murni lemon california":
    "https://shop-id.tokopedia.com/view/product/1737454037802911280?region=ID&locale=id-ID",
  // "Susu Kacang Kedelai Bubuk Murni 1kg - Soy Bean Milk Powder Tinggi Protein"
  "soy bean milk powder 1kg susu kacang kedelai bubuk murni tinggi protein nabati":
    "https://shop-id.tokopedia.com/view/product/1737454037802452528?region=ID&locale=id-ID",
  // "Susu Kacang Kedelai Bubuk Murni 200gr - Soy Bean Milk Powder Tanpa Gula"
  "soy bean milk powder 200gr susu kacang kedelai bubuk murni tinggi protein nabati":
    "https://shop-id.tokopedia.com/view/product/1737454037802386992?region=ID&locale=id-ID",
  // "Cuka Sari Apel Organik 500ml With Mother - Apple Cider Vinegar Murni Alami"
  "cuka apel 500ml with mother":
    "https://shop-id.tokopedia.com/view/product/1737454037802845744?region=ID&locale=id-ID",
  // "Madu Bawang Hitam Tunggal 250ml - Black Garlic Honey Fermentasi Herbal Alami"
  "black garlic honey madu bawang hitam 250ml":
    "https://shop-id.tokopedia.com/view/product/1737454037802583600?region=ID&locale=id-ID",
};

/**
 * Cari link produk berdasarkan nama.
 * Strategi: cocok persis -> salah satu nama merupakan awalan (prefix) nama
 * lainnya (min. 2 kata) -> tidak ditemukan (null).
 */
export function getTikTokProductLink(name: string): string | null {
  const key = normalize(name);
  if (!key) return null;

  const exact = byName.get(key);
  if (exact) return exact;

  const alias = ALIASES[key];
  if (alias) return alias;

  for (const k of KEYS) {
    // Nama live lebih pendek: prefix dari nama JSON (mis. "ESSEN CHINA" ->
    // "ESSEN CHINA - Olahraga & Outdoor Berkualitas").
    if (k.startsWith(key + " ") && key.split(" ").length >= 2) {
      return byName.get(k)!;
    }
    // Nama live lebih panjang: nama JSON adalah prefix-nya.
    if (key.startsWith(k + " ") && k.split(" ").length >= 2) {
      return byName.get(k)!;
    }
  }
  return null;
}
