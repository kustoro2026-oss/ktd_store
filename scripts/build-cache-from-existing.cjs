/**
 * Build products-cache.json from existing local data (NO network needed).
 *
 * Sources:
 *   - marketing-kit-links-all.json  → product IDs + names
 *   - product-images.json           → local image paths per product
 *
 * Usage: node scripts/build-cache-from-existing.cjs
 */

const fs = require("fs");
const path = require("path");

const MK_PATH = path.join(__dirname, "marketing-kit-links-all.json");
const IMG_MAP_PATH = path.join(__dirname, "..", "src", "lib", "product-images.json");
const CACHE_PATH = path.join(__dirname, "..", "src", "lib", "products-cache.json");

// Static categories (from the anekadropship.id category list we know)
const CATEGORIES = [
    { slug: "kecantikan", name: "Kecantikan" },
    { slug: "kesehatan", name: "Kesehatan" },
    { slug: "perawatan-hewan", name: "Perawatan Hewan" },
    { slug: "alat-rumah-tangga", name: "Alat Rumah Tangga" },
    { slug: "makanan-minuman", name: "Makanan & Minuman" },
    { slug: "pakaian", name: "Pakaian" },
    { slug: "olahraga", name: "Olahraga" },
    { slug: "elektronik", name: "Elektronik" },
    { slug: "otomotif", name: "Otomotif" },
    { slug: "perlengkapan-bayi", name: "Perlengkapan Bayi" },
    { slug: "aksesoris", name: "Aksesoris" },
    { slug: "sepatu", name: "Sepatu" },
    { slug: "tas", name: "Tas" },
    { slug: "perhiasan", name: "Perhiasan" },
    { slug: "fashion-muslim", name: "Fashion Muslim" },
    { slug: "perawatan-tubuh", name: "Perawatan Tubuh" },
    { slug: "suplemen", name: "Suplemen" },
    { slug: "obat", name: "Obat" },
    { slug: "perawatan-rambut", name: "Perawatan Rambut" },
    { slug: "makeup", name: "Makeup" },
    { slug: "parfum", name: "Parfum" },
    { slug: "perawatan-kulit", name: "Perawatan Kulit" },
    { slug: "perawatan-kuku", name: "Perawatan Kuku" },
    { slug: "perawatan-mata", name: "Perawatan Mata" },
    { slug: "perawatan-gigi", name: "Perawatan Gigi" },
    { slug: "perawatan-mulut", name: "Perawatan Mulut" },
    { slug: "perawatan-tangan", name: "Perawatan Tangan" },
    { slug: "perawatan-kaki", name: "Perawatan Kaki" },
];

function guessCategory(name) {
    const n = name.toLowerCase();
    for (const cat of CATEGORIES) {
        if (n.includes(cat.slug.replace(/-/g, " ")) || n.includes(cat.slug.replace(/-/g, ""))) {
            return cat.slug;
        }
    }
    return "";
}

function main() {
    console.log("Building products-cache.json from existing local data...");

    // Read product list (428 products)
    const mkProducts = JSON.parse(fs.readFileSync(MK_PATH, "utf8"));
    console.log(`  Marketing kit products: ${mkProducts.length}`);

    // Read image mapping
    const imageMap = JSON.parse(fs.readFileSync(IMG_MAP_PATH, "utf8"));
    const imageIds = Object.keys(imageMap);
    console.log(`  Products with local images: ${imageIds.length}`);

    // Build products array
    const products = [];
    for (const p of mkProducts) {
        const localImages = imageMap[p.id] || [];
        const image = localImages.length > 0
            ? localImages[0]
            : `/placeholder.svg`;

        products.push({
            id: String(p.id),
            name: p.name,
            image,
            location: "all",
            rekomendasiJual: "Rp -",
            hargaModal: "",
            hargaModalCut: "",
            terjual: "0",
            stok: "0",
            profit: "",
            category: guessCategory(p.name),
        });
    }

    // Save
    const cache = {
        generatedAt: new Date().toISOString(),
        categories: CATEGORIES,
        products,
    };

    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");

    console.log(`\nDone! ${products.length} products, ${CATEGORIES.length} categories`);
    console.log(`Saved to: ${CACHE_PATH}`);
    console.log(`\nNext: git add src/lib/products-cache.json && git commit -m "populate static cache" && git push`);
}

main();