/**
 * Static products cache — reads pre-scraped data from products-cache.json.
 *
 * Two ways to populate:
 * 1. node scripts/build-cache-from-existing.cjs — from local data (NO network)
 * 2. node scripts/scrape-products-cache.cjs — live scrape (needs cf_clearance)
 *
 * The JSON is imported at build time → instant at runtime.
 */
import type { AnekaCategory, AnekaProduct } from "./anekadropship";
import _cacheData from "./products-cache.json";

interface CacheData {
    generatedAt: string;
    categories: AnekaCategory[];
    products: AnekaProduct[];
}

// Static import — bundled at build time, no filesystem read at runtime.
const cacheData: CacheData = (_cacheData as CacheData) ?? { generatedAt: "", categories: [], products: [] };

/** Get categories from static cache. */
export function getStaticCategories(): AnekaCategory[] {
    return cacheData.categories;
}

/** Get all products from static cache. */
export function getStaticProducts(): AnekaProduct[] {
    return cacheData.products;
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