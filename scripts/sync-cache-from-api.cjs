/**
 * Pull product data from the live Vercel API and save as static cache.
 * Works even when anekadropship.id is blocked from local — the Vercel
 * server can still reach it (has different IP / CF_CLEARANCE set).
 *
 * Usage: node scripts/sync-cache-from-api.cjs
 */

const fs = require("fs");
const path = require("path");

const BASE = "https://toko.kustoro2026.com";
const OUTPUT = path.join(__dirname, "..", "src", "lib", "products-cache.json");

async function fetchJson(url) {
    const res = await fetch(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function main() {
    console.log("Fetching from Vercel API...");

    // 1. Get categories
    let categories = [];
    try {
        const data = await fetchJson(`${BASE}/api/categories`);
        categories = data.categories || [];
        console.log(`  Categories: ${categories.length}`);
    } catch (e) {
        console.log(`  Categories: FAILED (${e.message})`);
    }

    // 2. Get products (paginated)
    const all = [];
    const seen = new Set();

    for (let page = 1; page <= 10; page++) {
        try {
            const url = `${BASE}/api/products?sort=newest&page=${page}`;
            const data = await fetchJson(url);
            const products = data.products || [];
            let newCount = 0;

            for (const p of products) {
                if (!seen.has(p.id)) {
                    seen.add(p.id);
                    all.push(p);
                    newCount++;
                }
            }

            console.log(`  Page ${page}: ${newCount} new (total: ${all.length})`);

            if (products.length < 15) break; // last page
        } catch (e) {
            console.log(`  Page ${page}: FAILED (${e.message})`);
            break;
        }
    }

    // 3. Save
    const cache = {
        generatedAt: new Date().toISOString(),
        categories,
        products: all,
    };

    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, JSON.stringify(cache, null, 2), "utf-8");
    console.log(`\nSaved: ${all.length} products, ${categories.length} categories`);
    console.log(`File: ${OUTPUT}`);
}

main().catch((e) => {
    console.error("FATAL:", e.message);
    process.exit(1);
});