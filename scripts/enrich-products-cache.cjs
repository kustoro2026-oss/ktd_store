/**
 * Enrich src/lib/products-cache.json dengan data pengiriman dari
 * tiktok-export/products.json: berat, alamat seller, ekspedisi, volume, lokasi.
 *
 * Tidak butuh network dan idempotent (dijalankan berkali-kali hasilnya sama).
 * Field harga/stok/kategori yang sudah ada TIDAK ditimpa.
 *
 * Usage: node scripts/enrich-products-cache.cjs
 */

const fs = require("fs");
const path = require("path");

const RICH_PATH = path.join(__dirname, "..", "tiktok-export", "products.json");
const CACHE_PATH = path.join(__dirname, "..", "src", "lib", "products-cache.json");

/** Pecah daftar ekspedisi "JNE, JNT, Lion" -> ["JNE", "JNT", "Lion"]. */
function splitEkspedisi(s) {
    return String(s || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
}

function main() {
    const richRaw = JSON.parse(fs.readFileSync(RICH_PATH, "utf8"));
    const rich = Array.isArray(richRaw) ? richRaw : richRaw.products ?? [];
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));

    const byId = new Map(rich.map((r) => [String(r.id), r]));

    let matched = 0;
    let beratFilled = 0;
    let alamatFilled = 0;
    let ekspedisiFilled = 0;
    let volumeFilled = 0;
    let locationFilled = 0;

    for (const p of cache.products) {
        const r = byId.get(String(p.id));
        if (!r) continue;
        matched++;

        const beratGram = Number(r.weightGram);
        if (Number.isFinite(beratGram) && beratGram > 0) {
            p.beratGram = Math.round(beratGram);
            if (String(r.weightText || "").trim()) p.berat = String(r.weightText).trim();
            beratFilled++;
        }

        const alamat = String(r.alamatSeller || "").trim();
        if (alamat) {
            p.alamatSeller = alamat;
            alamatFilled++;
        }

        const ekspedisi = String(r.ekspedisi || "").trim();
        if (ekspedisi) {
            p.ekspedisi = ekspedisi;
            p.ekspedisiList = splitEkspedisi(ekspedisi);
            ekspedisiFilled++;
        }

        const volume = String(r.volumeText || "").trim();
        if (volume) {
            p.volume = volume;
            volumeFilled++;
        }

        // Lokasi badge seller: hanya isi jika cache belum punya kota spesifik.
        const loc = String(r.location || "").trim();
        if (loc && loc !== "all" && (!p.location || p.location === "all")) {
            p.location = loc;
            locationFilled++;
        }
    }

    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", "utf8");

    console.log(`Produk cache      : ${cache.products.length}`);
    console.log(`Match data lengkap: ${matched}`);
    console.log(`  + berat         : ${beratFilled}`);
    console.log(`  + alamat seller : ${alamatFilled}`);
    console.log(`  + ekspedisi     : ${ekspedisiFilled}`);
    console.log(`  + volume        : ${volumeFilled}`);
    console.log(`  + lokasi badge  : ${locationFilled}`);
    console.log(`Tersimpan: ${CACHE_PATH}`);
}

main();
