/**
 * AUDIT KATALOG KTD Store vs anekadropship.id
 * ============================================
 * Memeriksa sinkronisasi antara src/lib/products-cache.json dan listing live aneka:
 *   1. Produk di cache yang TIDAK tampil di listing manapun (main/malaysia/terbaru),
 *      diverifikasi ulang via search. Catatan: aneka MENYEMBUNYIKAN produk stok 0
 *      dari listing & search (detail page tetap ada) — ini penyebab utama temuan.
 *   2. Produk di listing aneka yang BELUM ada di cache (perlu re-scrape).
 *   3. Scan kartu listing: memastikan tidak ada kartu "Stok: 0" tampil (aturan aneka).
 *   4. (Opsional --details) Sapu halaman detail semua produk cache: 404 = produk
 *      sudah tidak ada di aneka.
 *
 * Usage:
 *   node scripts/audit-aneka-katalog.cjs            (listing + search + scan stok)
 *   node scripts/audit-aneka-katalog.cjs --details  (tambah sapu halaman detail)
 *   node scripts/audit-aneka-katalog.cjs --out=path (ubah lokasi laporan JSON)
 *
 * Exit code: 0 = PASS (tidak ada anomali), 1 = ada anomali / error.
 */
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BASE = "https://anekadropship.id";
const ROOT = path.resolve(__dirname, "..");
const DELAY = 450;
const TIMEOUT = 30000;

// Batas halaman per sumber (auto-stop saat halaman kosong / tanpa id baru)
const CAP = { main: 120, sorted: 120, malaysia: 60, terbaru: 10 };

const argv = process.argv.slice(2);
const WITH_DETAILS = argv.includes("--details");
const outArg = argv.find((a) => a.startsWith("--out="));
const OUT_PATH = outArg
    ? path.resolve(outArg.slice("--out=".length))
    : path.join(__dirname, "audit-aneka-katalog-report.json");

// ---- Env ----
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").replace(/\\\$/g, "$").trim();
    }
}
const EMAIL = process.env.ANEKA_EMAIL;
const PASSWORD = process.env.ANEKA_PASSWORD;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cookie = "";

function grab(res) {
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookies) {
        const pair = c.split(";")[0];
        const name = pair.split("=")[0];
        cookie = cookie.replace(new RegExp(name + "=[^;]*;?"), "") + pair + "; ";
    }
}

async function login() {
    cookie = "";
    const page = await fetch(`${BASE}/login`, { redirect: "manual", headers: HEADERS });
    grab(page);
    const $ = cheerio.load(await page.text());
    const token = $('input[name="_token"]').attr("value") ?? "";
    if (!token) throw new Error("CSRF token tidak ditemukan (halaman login berubah?)");
    const res = await fetch(`${BASE}/login`, {
        method: "POST",
        headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
        body: new URLSearchParams({ _token: token, email: EMAIL, password: PASSWORD }),
        redirect: "manual",
    });
    grab(res);
    const loc = res.headers.get("location") ?? "";
    if (res.status === 419 || (res.status >= 300 && res.status < 400 && loc.includes("/login"))) {
        throw new Error(`login ditolak (${res.status})`);
    }
    console.log("[login] OK");
}

async function fetchHtmlOnce(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { try { ctrl.abort(); } catch { /* noop */ } }, TIMEOUT);
    try {
        const res = await fetch(url, { headers: { ...HEADERS, Cookie: cookie }, redirect: "follow", signal: ctrl.signal });
        return { status: res.status, html: await res.text() };
    } finally {
        clearTimeout(timer);
    }
}

async function fetchPage(url) {
    let lastErr;
    for (let i = 0; i < 3; i++) {
        try {
            return await fetchHtmlOnce(url);
        } catch (e) {
            lastErr = e;
            await sleep(1500 * (i + 1));
        }
    }
    console.log(`    [warn] gagal fetch ${url}: ${lastErr?.name || lastErr?.message}`);
    return null;
}

// Potong di meta_ads.png (iklan) seperti parser scraper asli
function cutAds(html) {
    const idx = html.indexOf("meta_ads.png");
    return idx >= 0 ? html.slice(0, idx) : html;
}

/** Parse kartu listing: [{id, stok}] */
function parseCards(html) {
    const $ = cheerio.load(cutAds(html));
    const cards = [];
    $('a.line-clamp-2[href*="/products/"]').each((_, el) => {
        const href = $(el).attr("href") ?? "";
        const m = href.match(/\/products\/(\d+)/);
        if (!m) return;
        const card = $(el).closest("div.group");
        const sm = card.text().match(/Stok:\s*([\d.,]+)/);
        cards.push({ id: m[1], stok: sm ? sm[1].replace(/[.,]/g, "") : null });
    });
    return cards;
}

/** Kumpulkan id dari listing sampai halaman habis. */
async function collect(label, urlFor, cap) {
    const seen = new Set();
    const stokZero = [];
    let failed = 0;
    for (let page = 1; page <= cap; page++) {
        const res = await fetchPage(urlFor(page));
        if (!res) {
            failed++;
            if (failed >= 5) { console.log(`  [${label}] 5 halaman gagal, stop`); break; }
            continue;
        }
        if (/Login ke akun Anda/.test(res.html)) { console.log(`  [${label}] sesi login habis, stop`); break; }
        if (/tidak ada produk/i.test(res.html)) break;
        const cards = parseCards(res.html);
        if (cards.length === 0) break;
        let baru = 0;
        for (const c of cards) {
            if (!seen.has(c.id)) { seen.add(c.id); baru++; }
            if (c.stok === "0") stokZero.push(c.id);
        }
        if (baru === 0) break;
        if (page % 10 === 0) console.log(`  [${label}] halaman ${page}: total ${seen.size}`);
        await sleep(DELAY);
    }
    console.log(`  [${label}] selesai: ${seen.size} id${stokZero.length ? `, kartu stok-0: ${stokZero.length}` : ""}`);
    return { seen, stokZero };
}

/** Cari produk via search, kembalikan daftar id hasil. */
async function searchIds(query) {
    const q = encodeURIComponent(query);
    const res = await fetchPage(`${BASE}/user/home?search=${q}&category=&location=all&seller=all&page=1`);
    if (!res) return [];
    return parseCards(res.html).map((c) => c.id);
}

(async () => {
    if (!EMAIL || !PASSWORD) { console.error("ANEKA_EMAIL / ANEKA_PASSWORD kosong"); process.exit(1); }

    const cachePath = path.join(ROOT, "src", "lib", "products-cache.json");
    const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    const cacheProducts = cache.products ?? [];
    console.log(`Cache: ${cacheProducts.length} produk (generatedAt ${cache.generatedAt})`);

    await login();

    console.log("\n[1/4] Collect listing MAIN...");
    const main = await collect("main", (p) => `${BASE}/user/home?search=&category=&location=all&seller=all&page=${p}`, CAP.main);

    console.log("[2/4] Collect listing SORTED (newest)...");
    const sorted = await collect("sorted", (p) => `${BASE}/user/home?page=${p}&sort=newest`, CAP.sorted);

    console.log("[3/4] Collect listing MALAYSIA...");
    const malaysia = await collect("malaysia", (p) => `${BASE}/produk/semua/malaysia?page=${p}`, CAP.malaysia);

    console.log("[4/4] Collect listing TERBARU...");
    const terbaru = await collect("terbaru", (p) => `${BASE}/produk/semua/terbaru?page=${p}`, CAP.terbaru);

    const listingAll = new Set([...main.seen, ...sorted.seen, ...malaysia.seen, ...terbaru.seen]);
    const stokZeroCards = [...new Set([...main.stokZero, ...sorted.stokZero, ...malaysia.stokZero, ...terbaru.stokZero])];

    // --- 1. Produk cache yang tidak tampil di listing manapun ---
    const cacheIds = cacheProducts.map((p) => String(p.id));
    let candidates = cacheProducts.filter((p) => !listingAll.has(String(p.id)));
    console.log(`\nProduk cache tidak tampil di listing manapun: ${candidates.length}`);
    const candidateResults = [];
    let ci = 0;
    for (const c of candidates) {
        ci++;
        const query = String(c.name ?? "").split(/\s+/).slice(0, 4).join(" ");
        const ids = await searchIds(query);
        const foundInSearch = ids.includes(String(c.id));
        candidateResults.push({
            id: String(c.id),
            name: c.name,
            stok: String(c.stok ?? ""),
            location: c.location,
            foundInSearch,
            searchHits: ids.length,
        });
        if (!foundInSearch) {
            console.log(`  #${c.id} stok=${c.stok} TIDAK TAMPIL (listing+search) | ${String(c.name).slice(0, 60)}`);
        }
        await sleep(600 - DELAY);
    }
    const fullyHidden = candidateResults.filter((r) => !r.foundInSearch);

    // --- 2. Produk listing yang belum ada di cache ---
    const cacheSet = new Set(cacheIds);
    const missingFromCache = [...listingAll].filter((id) => !cacheSet.has(id));

    // --- 3. (Opsional) sapu halaman detail ---
    let detail404 = [];
    if (WITH_DETAILS) {
        console.log(`\n[--details] Sapu ${cacheIds.length} halaman detail...`);
        let done = 0;
        for (const id of cacheIds) {
            const res = await fetchPage(`${BASE}/products/${id}`);
            done++;
            if (!res || res.status === 404) detail404.push(id);
            if (done % 50 === 0) console.log(`  ${done}/${cacheIds.length}... (404: ${detail404.length})`);
            await sleep(300);
        }
        console.log(`  Selesai. 404: ${detail404.length}`);
    }

    // --- Ringkasan ---
    const pass =
        fullyHidden.length === 0 &&
        missingFromCache.length === 0 &&
        stokZeroCards.length === 0 &&
        detail404.length === 0;

    console.log("\n================ RINGKASAN AUDIT ================");
    console.log(`Cache              : ${cacheIds.length} produk`);
    console.log(`Listing live       : main=${main.seen.size} sorted=${sorted.seen.size} malaysia=${malaysia.seen.size} terbaru=${terbaru.seen.size}`);
    console.log(`Kartu stok-0 tampil: ${stokZeroCards.length}${stokZeroCards.length ? ` (${stokZeroCards.slice(0, 10).join(",")})` : ""}`);
    console.log(`Cache TIDAK tampil : ${candidates.length} (tidak ketemu via search: ${fullyHidden.length})`);
    for (const r of fullyHidden) console.log(`  - #${r.id} stok=${r.stok} | ${String(r.name).slice(0, 70)}`);
    console.log(`Listing BELUM di cache: ${missingFromCache.length}${missingFromCache.length ? ` (${missingFromCache.slice(0, 15).join(",")})` : ""}`);
    if (WITH_DETAILS) console.log(`Detail 404         : ${detail404.length}${detail404.length ? ` (${detail404.slice(0, 15).join(",")})` : ""}`);
    console.log(`\nHASIL: ${pass ? "PASS — katalog sinkron dengan aneka" : "FAIL — ada anomali, lihat detail di atas"}`);
    console.log("=================================================");

    fs.writeFileSync(OUT_PATH, JSON.stringify({
        generatedAt: new Date().toISOString(),
        pass,
        counts: {
            cache: cacheIds.length,
            main: main.seen.size,
            sorted: sorted.seen.size,
            malaysia: malaysia.seen.size,
            terbaru: terbaru.seen.size,
        },
        stokZeroCards,
        candidates: candidateResults,
        fullyHidden,
        missingFromCache,
        detail404,
    }, null, 2), "utf8");
    console.log(`Laporan: ${OUT_PATH}`);

    process.exit(pass ? 0 : 1);
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
