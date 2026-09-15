// Pemetaan nama produk -> link Lazada.
// Sumber data: lazada-products.json (hasil scrape Lazada Seller Center).
// Dipakai untuk tombol marketplace "Lazada" di halaman produk & keranjang.

import lazadaProducts from "../../lazada-products.json";

type LazadaProductEntry = {
    name: string;
    url: string;
    price?: string;
    stock?: number;
};

const SOURCE = lazadaProducts as LazadaProductEntry[];

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
 * berbeda dari nama di lazada-products.json, tapi produknya sama.
 * Key = nama live hasil normalize(); value = url produk.
 */
const ALIASES: Record<string, string> = {
    // Tambahkan alias manual di sini jika diperlukan
};

/**
 * Cari link produk Lazada berdasarkan nama.
 * Strategi: cocok persis -> salah satu nama merupakan awalan (prefix) nama
 * lainnya (min. 2 kata) -> tidak ditemukan (null).
 */
export function getLazadaProductLink(name: string): string | null {
    const key = normalize(name);
    if (!key) return null;

    const exact = byName.get(key);
    if (exact) return exact;

    const alias = ALIASES[key];
    if (alias) return alias;

    for (const k of KEYS) {
        // Nama live lebih pendek: prefix dari nama JSON
        if (k.startsWith(key + " ") && key.split(" ").length >= 2) {
            return byName.get(k)!;
        }
        // Nama live lebih panjang: nama JSON adalah prefix-nya
        if (key.startsWith(k + " ") && k.split(" ").length >= 2) {
            return byName.get(k)!;
        }
    }
    return null;
}