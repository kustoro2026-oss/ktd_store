/**
 * Merge scraped products (real prices/stock) with the full product list
 * from marketing-kit-links-all.json. Result: all 428 products, with real
 * data for the ones that were successfully scraped.
 *
 * Usage: node scripts/merge-cache.cjs
 */

const fs = require("fs");
const path = require("path");

const MK_PATH = path.join(__dirname, "marketing-kit-links-all.json");
const IMG_MAP_PATH = path.join(__dirname, "..", "src", "lib", "product-images.json");
const CACHE_PATH = path.join(__dirname, "..", "src", "lib", "products-cache.json");

// Clean product names: strip [STORE] tags, META ADS, etc.
function cleanName(raw) {
    let s = raw.replace(/\s+/g, " ").trim();
    s = s.replace(/^\s*(?:\[[^\]]*\]\s*)+/, "");
    s = s.replace(/\b(?:META\s*ADS(?:\s*ONLY)?|ADS\s*ONLY)\b/gi, " ");
    s = s.replace(/\s*\[[^\]]*\]\s*/g, " ");
    s = s.replace(/\s{2,}/g, " ").trim();
    return s || raw.trim();
}

function main() {
    console.log("Merging scraped data with full product list...");

    // Read scraped cache
    const scraped = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    const scrapedMap = {};
    for (const p of scraped.products) {
        scrapedMap[p.id] = p;
    }
    console.log(`  Scraped products: ${scraped.products.length}`);

    // Read full product list (428 products)
    const allProducts = JSON.parse(fs.readFileSync(MK_PATH, "utf8"));
    console.log(`  Full product list: ${allProducts.length}`);

    // Read image mapping
    const imageMap = JSON.parse(fs.readFileSync(IMG_MAP_PATH, "utf8"));

    // Merge: use scraped data when available, otherwise create from full list
    const merged = [];
    const seen = new Set();

    // First, add scraped products (they have real prices/stock)
    for (const p of scraped.products) {
        if (!seen.has(p.id)) {
            seen.add(p.id);
            const localImages = imageMap[p.id] || [];
            merged.push({
                ...p,
                name: cleanName(p.name),
                image: localImages.length > 0 ? localImages[0] : p.image,
            });
        }
    }

    // Then, add remaining products from full list (no real prices)
    for (const p of allProducts) {
        if (!seen.has(String(p.id))) {
            seen.add(String(p.id));
            const localImages = imageMap[String(p.id)] || [];
            merged.push({
                id: String(p.id),
                name: cleanName(p.name),
                image: localImages.length > 0 ? localImages[0] : "/placeholder.svg",
                location: "all",
                rekomendasiJual: "Rp -",
                hargaModal: "",
                hargaModalCut: "",
                terjual: "0",
                stok: "0",
                profit: "",
                category: "",
            });
        }
    }

    // Save
    const cache = {
        generatedAt: new Date().toISOString(),
        categories: scraped.categories,
        products: merged,
    };

    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");

    // Count products with real prices
    const withPrice = merged.filter((p) => p.rekomendasiJual && p.rekomendasiJual !== "Rp -").length;

    console.log(`\nDone! ${merged.length} total products`);
    console.log(`  With real prices: ${withPrice}`);
    console.log(`  Without prices: ${merged.length - withPrice}`);
    console.log(`  Categories: ${scraped.categories.length}`);
    console.log(`\nSaved to: ${CACHE_PATH}`);
}

main();