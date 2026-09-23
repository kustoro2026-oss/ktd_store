/**
 * ENRICH DESKRIPSI: Sapu halaman detail aneka → src/lib/description-cache.json
 * ==========================================================================
 * Untuk setiap produk di products-cache.json, ambil descriptionHtml yang sudah
 * dibersihkan + diformat oleh pipeline situs (cleanDescription() +
 * formatDescription() di src/lib/anekadropship.ts):
 *   - base64 dibuang, gambar tanpa src dibuang
 *   - "Panduan Aman Upload Produk", "META ADS ONLY", referensi marketing kit dibuang
 *   - heading section jadi <h3> beremoji, list rapi, tabel dirapikan
 *
 * File hasil dipakai oleh src/lib/description-cache.ts → detail-cache.ts
 * (section "Deskripsi Produk" di halaman produk + meta description SEO).
 *
 * Usage:
 *   npx tsx scripts/enrich-descriptions-cache.ts            (semua produk, resume)
 *   npx tsx scripts/enrich-descriptions-cache.ts --fresh    (mulai dari nol)
 *   npx tsx scripts/enrich-descriptions-cache.ts --limit=20 (uji coba)
 *   npx tsx scripts/enrich-descriptions-cache.ts --only=530,1587
 *   npx tsx scripts/enrich-descriptions-cache.ts --only=530,1587 --force
 *
 * Resume: hasil sementara di scripts/_description-cache-partial.json
 * (checkpoint tiap 40 produk); produk yang sudah discan dilewati pada run
 * berikutnya. --force memaksa scan ulang id yang diberikan via --only.
 */
import * as fs from "fs";
import * as path from "path";
import { anekaClient } from "../src/lib/anekadropship";

const ROOT = process.cwd();
const CACHE_PATH = path.join(ROOT, "src", "lib", "products-cache.json");
const OUT_PATH = path.join(ROOT, "src", "lib", "description-cache.json");
const PARTIAL_PATH = path.join(ROOT, "scripts", "_description-cache-partial.json");
const DELAY = 250;
const WORKERS = 3;

const argv = process.argv.slice(2);
const FRESH = argv.includes("--fresh");
const FORCE = argv.includes("--force");
const limitArg = argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.slice("--limit=".length)) : 0;
const onlyArg = argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg
    ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim())
    : null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Muat env dari .env + .env.local (pola sama dengan enrich-variants-cache.cjs). */
function loadEnv() {
    for (const file of [".env", ".env.local"]) {
        const p = path.join(ROOT, file);
        if (!fs.existsSync(p)) continue;
        for (const line of fs.readFileSync(p, "utf8").split("\n")) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").replace(/\\\$/g, "$").trim();
        }
    }
}

function loadProducts(): { id: string }[] {
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    let products: { id: string }[] = cache.products ?? [];
    if (ONLY) {
        const set = new Set(ONLY);
        products = products.filter((p) => set.has(String(p.id)));
    }
    if (LIMIT > 0) products = products.slice(0, LIMIT);
    return products;
}

function loadPartial(): Record<string, string> {
    if (FRESH || !fs.existsSync(PARTIAL_PATH)) return {};
    try {
        return JSON.parse(fs.readFileSync(PARTIAL_PATH, "utf8"));
    } catch {
        return {};
    }
}

function savePartial(partial: Record<string, string>) {
    fs.writeFileSync(PARTIAL_PATH, JSON.stringify(partial), "utf8");
}

async function main() {
    loadEnv();
    if (!process.env.ANEKA_EMAIL || !process.env.ANEKA_PASSWORD) {
        console.error("ANEKA_EMAIL / ANEKA_PASSWORD kosong (cek .env / .env.local)");
        process.exit(1);
    }

    const products = loadProducts();
    const partial = loadPartial();
    const todo = products.filter(
        (p) => FORCE || !(String(p.id) in partial),
    );
    console.log(
        `Produk total: ${products.length} | sudah discan: ${products.length - todo.length} | sisa: ${todo.length}`,
    );

    await anekaClient.ensureLoggedIn();
    console.log("[login] OK");

    let done = products.length - todo.length;
    let failed = 0;
    let cursor = 0;

    async function worker(wid: number) {
        while (true) {
            const idx = cursor++;
            if (idx >= todo.length) return;
            const id = String(todo[idx].id);
            try {
                const d = await anekaClient.getProductDetail(id);
                partial[id] = d.descriptionHtml ?? "";
            } catch (e) {
                failed++;
                console.log(`  [w${wid}] #${id} GAGAL: ${(e as Error).message} (diulang run berikutnya)`);
            }
            done++;
            if (done % 40 === 0) {
                savePartial(partial);
                const withDesc = Object.values(partial).filter((h) => h.length > 0).length;
                console.log(`  progres: ${done}/${products.length} | dengan deskripsi: ${withDesc} | gagal: ${failed}`);
            }
            await sleep(DELAY);
        }
    }

    await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i + 1)));
    savePartial(partial);

    // ---- Tulis file final (gabungan seluruh partial, termasuk run --only) ----
    const out = {
        generatedAt: new Date().toISOString(),
        scanned: 0,
        withDescription: 0,
        empty: 0,
        totalChars: 0,
        products: {} as Record<string, string>,
    };
    let imgs = 0;
    const ids = Object.keys(partial).sort((a, b) => Number(a) - Number(b));
    for (const id of ids) {
        const html = partial[id] ?? "";
        out.scanned++;
        if (html.length > 0) {
            out.withDescription++;
            out.totalChars += html.length;
            imgs += (html.match(/<img/gi) ?? []).length;
        } else {
            out.empty++;
        }
        out.products[id] = html;
    }
    fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");

    console.log("\n================ RINGKASAN ================");
    console.log(`Tersimpan        : ${OUT_PATH}`);
    console.log(`Discan           : ${out.scanned} produk`);
    console.log(`Dengan deskripsi : ${out.withDescription} produk`);
    console.log(`Kosong           : ${out.empty} produk (bisa diulang dgn --only + --force)`);
    console.log(`Total karakter   : ${out.totalChars}`);
    console.log(`Gambar <img>     : ${imgs}`);
    console.log(`Gagal fetch      : ${failed} (jalankan ulang untuk melengkapi)`);
    console.log("===========================================");
}

main().catch((e) => {
    console.error("FATAL:", (e as Error).message);
    process.exit(1);
});
