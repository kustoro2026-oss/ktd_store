// Pemetaan nama produk -> link produk Blibli.
// Sumber data: blibli-products.json (hasil scrape Blibli Seller Center, API
// filterProductSkus — 612 produk aktif; dibuat oleh scripts/build-blibli-products.cjs).
// Dipakai untuk tombol marketplace "Blibli" di halaman produk & keranjang.

import blibliProducts from "../../blibli-products.json";

type BlibliProductEntry = {
  id: string;
  name: string;
  url: string;
  price?: string;
  stock?: number | null;
};

const SOURCE = blibliProducts as BlibliProductEntry[];

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
 * Alias manual: nama produk di katalog (live) yang berbeda dari nama listing
 * di blibli-products.json, tapi produknya sama. Terjadi karena judul listing
 * di Seller Center ikut disanitasi saat proses revisi (kata brand/marketplace
 * lain dihapus, brand ditambahkan).
 * Key = nama katalog hasil normalize(); value = url produk Blibli.
 */
const ALIASES: Record<string, string> = {
  // [1055]: "...Viral TikTok..." -> listing Blibli tanpa kata "TikTok".
  "8 pcs x 30gr detergen bubuk viral tiktok cloth stain remover ampuh hilangkan noda jamur kuning pakaian bersih seketika":
    "https://www.blibli.com/product-detail-KTS.70007.00188.html",
  // [962]: "Pembersih Tas" -> listing memakai nama brand "Miss Clean Pembersih Tas".
  "pembersih tas": "https://www.blibli.com/product-detail-KTS.70007.00240.html",
  // [958]: "Pembersih Meja" -> "Miss Clean Pembersih Meja".
  "pembersih meja": "https://www.blibli.com/product-detail-KTS.70007.00248.html",
  // [956]: "Pembersih Wajan" -> "Miss Clean Pembersih Wajan".
  "pembersih wajan": "https://www.blibli.com/product-detail-KTS.70007.00251.html",
  // [757]: "SIDOARJO Detergen Khusus" -> listing "Detergen Khusus".
  "sidoarjo detergen khusus": "https://www.blibli.com/product-detail-KTS.70007.00297.html",
  // [1370]: prefix "Pocket Slingbag - ... POCKETSling" dihapus di listing Blibli.
  "pocket slingbag tas selempang slingbag wanita pocketsling bag simple desain minimalis bahan motif kombinasi":
    "https://www.blibli.com/product-detail-KTS.70007.00477.html",
  // [1357]: "250 Gram – Perangsang Bunga..." -> listing disanitasi jadi "Booster Bunga".
  "pupuk pelebat tanaman buah 250 gram perangsang bunga buah lebat":
    "https://www.blibli.com/product-detail-KTS.70007.00727.html",
  // [2174]: idem untuk varian "Booster Tanaman Buah".
  "pupuk booster tanaman buah 250 gram perangsang bunga buah lebat":
    "https://www.blibli.com/product-detail-KTS.70007.00729.html",
};

/**
 * Cari link produk Blibli berdasarkan nama.
 * Strategi: cocok persis -> alias manual -> salah satu nama merupakan awalan
 * (prefix) nama lainnya (min. 2 kata) -> tidak ditemukan (null).
 */
export function getBlibliProductLink(name: string): string | null {
  const key = normalize(name);
  if (!key) return null;

  const exact = byName.get(key);
  if (exact) return exact;

  const alias = ALIASES[key];
  if (alias) return alias;

  for (const k of KEYS) {
    // Nama katalog lebih pendek: prefix dari nama JSON Blibli.
    if (k.startsWith(key + " ") && key.split(" ").length >= 2) {
      return byName.get(k)!;
    }
    // Nama katalog lebih panjang: nama JSON Blibli adalah prefix-nya.
    if (key.startsWith(k + " ") && k.split(" ").length >= 2) {
      return byName.get(k)!;
    }
  }
  return null;
}
