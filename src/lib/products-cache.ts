/**
 * Static products cache — reads pre-scraped data from products-cache.json, plus
 * katalog tambahan Evermos (EVM-*) dari evermos-products-cache.json
 * (dibangun scripts/build-evermos-site-data.cjs), digabung dengan interleave.
 *
 * Two ways to populate aneka:
 * 1. node scripts/build-cache-from-existing.cjs — from local data (NO network)
 * 2. node scripts/scrape-products-cache.cjs — live scrape (needs cf_clearance)
 *
 * The JSON is imported at build time → instant at runtime.
 */
import type { AnekaCategory, AnekaProduct } from "./anekadropship";
import _cacheData from "./products-cache.json";
import _evermosData from "./evermos-products-cache.json";

interface CacheData {
    generatedAt: string;
    categories: AnekaCategory[];
    products: AnekaProduct[];
}

// Static import — bundled at build time, no filesystem read at runtime.
const cacheData: CacheData = (_cacheData as CacheData) ?? { generatedAt: "", categories: [], products: [] };
const evermosData: CacheData = (_evermosData as CacheData) ?? { generatedAt: "", categories: [], products: [] };

/**
 * Gabungkan katalog anekadropship + Evermos dengan interleave merata supaya
 * produk kedua sumber tersebar (bukan menumpuk di akhir daftar). Rasio saat ini
 * ± 1 aneka : 7 Evermos; sisa Evermos ditaruh setelah aneka terakhir.
 */
function mergeProducts(primary: AnekaProduct[], secondary: AnekaProduct[]): AnekaProduct[] {
    if (secondary.length === 0) return primary;
    if (primary.length === 0) return secondary;
    const step = Math.max(1, Math.round(secondary.length / primary.length));
    const out: AnekaProduct[] = [];
    let j = 0;
    for (const p of primary) {
        out.push(p);
        for (let i = 0; i < step && j < secondary.length; i++) out.push(secondary[j++]);
    }
    while (j < secondary.length) out.push(secondary[j++]);
    return out;
}

const mergedProducts: AnekaProduct[] = mergeProducts(cacheData.products, evermosData.products);

/** Get categories from static cache. */
export function getStaticCategories(): AnekaCategory[] {
    return cacheData.categories;
}

/** Get all products (anekadropship + Evermos) from static cache. */
export function getStaticProducts(): AnekaProduct[] {
    return mergedProducts;
}

/** Produk anekadropship saja (tanpa Evermos) — pool rotasi section beranda. */
export function getStaticAnekaProducts(): AnekaProduct[] {
    return cacheData.products;
}

/** Produk Evermos (EVM-*) saja — pool rotasi section beranda. */
export function getStaticEvermosProducts(): AnekaProduct[] {
    return evermosData.products;
}

/** Check if static cache is available and not too stale (> 7 days). */
export function isStaticCacheFresh(): boolean {
    if (!cacheData.generatedAt) return false;
    const age = Date.now() - new Date(cacheData.generatedAt).getTime();
    return age < 7 * 24 * 3600_000;
}

/** Get cache generation timestamp for display. */
export function getStaticCacheDate(): string | null {
    return cacheData.generatedAt || null;
}