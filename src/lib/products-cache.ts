/**
 * Static products cache — reads pre-scraped data from products-cache.json.
 *
 * Two-trigger architecture:
 * 1. STATIC (always available): products-cache.json committed to repo.
 *    Run `node scripts/scrape-products-cache.cjs` to refresh.
 * 2. LIVE (optional): when CF_CLEARANCE env var is set, API routes
 *    fall back to live scraping for fresher data.
 */
import { readFileSync } from "fs";
import { join } from "path";
import type { AnekaCategory, AnekaProduct } from "./anekadropship";

interface CacheData {
    generatedAt: string;
    categories: AnekaCategory[];
    products: AnekaProduct[];
}

let _cache: CacheData | null | undefined = undefined;

function loadCache(): CacheData | null {
    if (_cache !== undefined) return _cache;
    try {
        const path = join(process.cwd(), "src", "lib", "products-cache.json");
        _cache = JSON.parse(readFileSync(path, "utf-8")) as CacheData;
        return _cache;
    } catch {
        _cache = null;
        return null;
    }
}

/** Get categories from static cache. Returns empty array if cache unavailable. */
export function getStaticCategories(): AnekaCategory[] {
    return loadCache()?.categories ?? [];
}

/** Get all products from static cache. Returns empty array if cache unavailable. */
export function getStaticProducts(): AnekaProduct[] {
    return loadCache()?.products ?? [];
}

/** Check if static cache is available and not too stale (> 7 days). */
export function isStaticCacheFresh(): boolean {
    const c = loadCache();
    if (!c) return false;
    const age = Date.now() - new Date(c.generatedAt).getTime();
    return age < 7 * 24 * 3600_000;
}

/** Get cache generation timestamp for display. */
export function getStaticCacheDate(): string | null {
    return loadCache()?.generatedAt ?? null;
}