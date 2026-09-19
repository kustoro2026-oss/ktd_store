// Script: Cek produk baru dari anekadropship.id dan sinkronisasi gambar.
// Jalankan: node scripts/check-new-products.mjs
import * as fs from "node:fs";
import * as path from "node:path";

// Load .env.local
const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").replace(/\\\$/g, "$").trim();
    }
}

const { anekaClient } = await import("../src/lib/anekadropship.ts");

const BASE = "https://anekadropship.id";
const OUT_DIR = path.join(process.cwd(), "public", "images", "products");
const MAPPING_PATH = path.join(process.cwd(), "src", "lib", "product-images.json");
const MAX_PAGES = 200;

function absUrl(u) {
    if (/^https?:\/\//i.test(u)) return u;
    return BASE + (u.startsWith("/") ? u : `/${u}`);
}

function extOf(url) {
    const m = url.split("?")[0].toLowerCase().match(/\.(webp|png|jpe?g|gif|avif)$/);
    return m ? (m[1] === "jpeg" ? "jpg" : m[1]) : "jpg";
}

async function fileExists(p) {
    try { return (await fs.promises.stat(p)).size > 0; }
    catch { return false; }
}

async function downloadFile(url, dest) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error("empty body");
    await fs.promises.writeFile(dest, buf);
}

function loadMapping() {
    try { return JSON.parse(fs.readFileSync(MAPPING_PATH, "utf8")); }
    catch { return {}; }
}

function saveMapping(mapping) {
    const sorted = {};
    for (const k of Object.keys(mapping).sort((a, b) => Number(a) - Number(b))) {
        sorted[k] = mapping[k];
    }
    fs.writeFileSync(MAPPING_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function collectAllProducts() {
    const map = new Map();

    const walk = async (fetchPage) => {
        for (let p = 1; p <= MAX_PAGES; p++) {
            const items = await fetchPage(p);
            if (!items.length) break;
            for (const it of items) {
                if (!map.has(it.id) && it.image) map.set(it.id, it.image);
            }
            await sleep(400);
        }
    };

    // Main listing
    await walk(async (page) => {
        const { products } = await anekaClient.getProducts({ page });
        return products.map((p) => ({ id: p.id, image: p.image }));
    });

    // Newest listing
    try {
        anekaClient.resetSession();
        await walk(async (page) => {
            const { products } = await anekaClient.getNewestProducts({ page });
            return products.map((p) => ({ id: p.id, image: p.image }));
        });
    } catch (e) {
        console.log("⚠️  Listing terbaru gagal (lanjut dengan produk dari listing utama):", e.message?.slice(0, 80));
    }

    return Array.from(map.entries()).map(([id, image]) => ({ id, image }));
}

async function main() {
    console.log("🔐 Login ke anekadropship.id...");
    await anekaClient.ensureLoggedIn();
    console.log("✅ Login berhasil!\n");

    // 1) Kumpulkan semua produk
    console.log("📦 Mengumpulkan semua produk dari anekadropship...");
    const allProducts = await collectAllProducts();
    console.log(`   Total produk ditemukan: ${allProducts.length}\n`);

    // 2) Bandingkan dengan mapping yang sudah ada
    const existingMapping = loadMapping();
    const existingIds = new Set(Object.keys(existingMapping));
    const newProducts = allProducts.filter((p) => !existingIds.has(p.id));

    console.log(`📊 Produk sudah tersinkron: ${existingIds.size}`);
    console.log(`🆕 Produk baru: ${newProducts.length}\n`);

    if (newProducts.length === 0) {
        console.log("✅ Tidak ada produk baru. Semua produk sudah tersinkron.");
        return;
    }

    // 3) Tampilkan daftar produk baru
    console.log("=== DAFTAR PRODUK BARU ===");
    for (const p of newProducts) {
        console.log(`  [${p.id}] ${p.image}`);
    }
    console.log();

    // 4) Download gambar untuk produk baru
    console.log("📥 Mengunduh gambar untuk produk baru...");
    await fs.promises.mkdir(OUT_DIR, { recursive: true });

    let newImages = 0;
    let skipped = 0;
    let failedProducts = 0;

    for (const { id, image } of newProducts) {
        try {
            let urls = [];
            try {
                const detail = await anekaClient.getProductDetail(id);
                urls = detail.images.filter(Boolean);
            } catch {
                // Detail gagal — pakai gambar utama dari kartu
            }
            if (!urls.length && image) urls = [image];

            const seen = new Set();
            const local = [];
            let i = 0;
            for (const u of urls) {
                const abs = absUrl(u);
                if (seen.has(abs)) continue;
                seen.add(abs);
                const file = `${id}-${i}.${extOf(abs)}`;
                const dest = path.join(OUT_DIR, file);
                i++;
                if (await fileExists(dest)) {
                    local.push(`/images/products/${file}`);
                    continue;
                }
                try {
                    await downloadFile(abs, dest);
                    local.push(`/images/products/${file}`);
                    newImages++;
                    console.log(`  ✅ [${id}] gambar ${i}: ${file}`);
                } catch (e) {
                    console.log(`  ⚠️  [${id}] gagal unduh gambar ${i}: ${e.message?.slice(0, 60)}`);
                }
            }

            existingMapping[id] = local;
            await sleep(200);
        } catch (e) {
            failedProducts++;
            console.log(`  ❌ [${id}] gagal: ${e.message?.slice(0, 80)}`);
        }
    }

    // 5) Simpan mapping
    saveMapping(existingMapping);

    console.log("\n=== HASIL SINKRONISASI ===");
    console.log(`   Total produk: ${allProducts.length}`);
    console.log(`   Produk baru ditemukan: ${newProducts.length}`);
    console.log(`   Gambar baru diunduh: ${newImages}`);
    console.log(`   Produk gagal: ${failedProducts}`);
    console.log(`   Mapping tersimpan di: ${MAPPING_PATH}`);
}

main().catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
});