/**
 * Isi "terjual" produk yang masih 0/kosong dengan angka acak 5-10 supaya
 * tidak ada produk tampil "0 terjual" di katalog (card, flash sale, detail).
 *
 * Produk dengan terjual >= 1 TIDAK diubah. Idempotent: dijalankan ulang hanya
 * menyentuh produk yang masih 0/kosong (mis. setelah sync cache dari API).
 *
 * Usage: node scripts/fill-terjual-cache.cjs
 */

const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "..", "src", "lib", "products-cache.json");
const MIN = 5;
const MAX = 10;

/** Integer acak inklusif min..max. */
function randomBetween(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function main() {
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    const products = cache.products ?? [];

    let filled = 0;
    const dist = {};
    for (const p of products) {
        const current = String(p.terjual ?? "").trim();
        if (current === "" || current === "0") {
            const v = randomBetween(MIN, MAX);
            p.terjual = String(v);
            dist[v] = (dist[v] ?? 0) + 1;
            filled++;
        }
    }

    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", "utf8");

    const distText = Object.entries(dist)
        .sort((a, b) => a[0] - b[0])
        .map(([k, v]) => `${k}:${v}`)
        .join(", ");
    console.log(`Total produk  : ${products.length}`);
    console.log(`Diisi terjual : ${filled} produk (acak ${MIN}-${MAX})`);
    console.log(`Distribusi    : ${distText || "-"}`);
    console.log(`Tersimpan: ${CACHE_PATH}`);
}

main();
