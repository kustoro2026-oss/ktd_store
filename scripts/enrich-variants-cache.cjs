/**
 * ENRICH VARIAN: Sapu halaman detail aneka → src/lib/variant-cache.json
 * ====================================================================
 * Untuk setiap produk di products-cache.json, ambil data varian dari atribut
 * Alpine x-data="productActionDetail({...})" (hanya tersedia saat login):
 *   { id, name, color, size, price, hpp, stock, is_active, label }
 * Yang disimpan (modal price TIDAK disimpan — hanya untuk tampilan):
 *   { id, name(=label supplier), color, size, stock, isActive }
 *
 * File hasil dipakai oleh src/lib/variant-cache.ts → detail-cache.ts
 * (picker varian di halaman produk + label varian di pesan WhatsApp).
 *
 * Usage:
 *   node scripts/enrich-variants-cache.cjs            (semua produk, resume)
 *   node scripts/enrich-variants-cache.cjs --fresh    (mulai dari nol)
 *   node scripts/enrich-variants-cache.cjs --limit=20 (uji coba)
 *   node scripts/enrich-variants-cache.cjs --only=530,1587
 *
 * Resume: hasil sementara di scripts/_variant-cache-partial.json (checkpoint
 * tiap 40 produk); produk yang sudah discan dilewati pada run berikutnya.
 */
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BASE = "https://anekadropship.id";
const ROOT = path.resolve(__dirname, "..");
const CACHE_PATH = path.join(ROOT, "src", "lib", "products-cache.json");
const OUT_PATH = path.join(ROOT, "src", "lib", "variant-cache.json");
const PARTIAL_PATH = path.join(__dirname, "_variant-cache-partial.json");
const DELAY = 300;
const TIMEOUT = 30000;
const WORKERS = 2;

const argv = process.argv.slice(2);
const FRESH = argv.includes("--fresh");
const limitArg = argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.slice("--limit=".length)) : 0;
const onlyArg = argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim()) : null;

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
let loginPromise = null;

function grab(res) {
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookies) {
        const pair = c.split(";")[0];
        const name = pair.split("=")[0];
        cookie = cookie.replace(new RegExp(name + "=[^;]*;?"), "") + pair + "; ";
    }
}

/** Login ter-serialisasi: request paralel berbagi satu promise. */
function login() {
    if (!loginPromise) {
        loginPromise = (async () => {
            cookie = "";
            const page = await fetch(`${BASE}/login`, { redirect: "manual", headers: HEADERS });
            grab(page);
            const $ = cheerio.load(await page.text());
            const token = $('input[name="_token"]').attr("value") ?? "";
            if (!token) throw new Error("CSRF token tidak ditemukan");
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
        })().finally(() => { loginPromise = null; });
    }
    return loginPromise;
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

/** Fetch dengan retry + re-login bila sesi mati. Null jika tetap gagal. */
async function fetchPage(url) {
    for (let i = 0; i < 3; i++) {
        try {
            const r = await fetchHtmlOnce(url);
            if (r.status === 404) return r;
            if (r.html.includes("Login ke akun Anda")) {
                await login();
                continue;
            }
            if (r.status === 200) return r;
        } catch { /* retry */ }
        await sleep(1200 * (i + 1));
    }
    return null;
}

/** Ekstrak objek productData dari x-data="productActionDetail(...)". */
function extractProductData(html) {
    const m = html.match(/x-data="productActionDetail\(([^"]+)\)"/);
    if (!m) return null;
    const s = m[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&gt;/g, ">")
        .replace(/&lt;/g, "<")
        .replace(/&#39;/g, "'");
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

/** Map varian supplier → bentuk cache (tanpa harga modal). */
function mapVariants(pd) {
    const raw = Array.isArray(pd?.variants) ? pd.variants : [];
    return raw
        .filter((v) => v && (v.id != null))
        .map((v) => ({
            id: String(v.id),
            name: String(v.label ?? v.name ?? "").trim(),
            color: v.color == null || v.color === "" ? null : String(v.color).trim(),
            size: v.size == null || v.size === "" ? null : String(v.size).trim(),
            stock: Number.isFinite(Number(v.stock)) ? Number(v.stock) : 0,
            isActive: v.is_active !== false,
        }));
}

// ---- Muat daftar produk ----
function loadProducts() {
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    let products = cache.products ?? [];
    if (ONLY) {
        const set = new Set(ONLY);
        products = products.filter((p) => set.has(String(p.id)));
    }
    if (LIMIT > 0) products = products.slice(0, LIMIT);
    return products;
}

function loadPartial() {
    if (FRESH || !fs.existsSync(PARTIAL_PATH)) return {};
    try { return JSON.parse(fs.readFileSync(PARTIAL_PATH, "utf8")); } catch { return {}; }
}

function savePartial(partial) {
    fs.writeFileSync(PARTIAL_PATH, JSON.stringify(partial), "utf8");
}

(async () => {
    if (!EMAIL || !PASSWORD) { console.error("ANEKA_EMAIL / ANEKA_PASSWORD kosong"); process.exit(1); }

    const products = loadProducts();
    const partial = loadPartial();
    const todo = products.filter((p) => !(String(p.id) in partial));
    console.log(`Produk total: ${products.length} | sudah discan: ${products.length - todo.length} | sisa: ${todo.length}`);

    await login();

    let done = products.length - todo.length;
    let failed = 0;
    let noXdata = 0;
    let cursor = 0;

    async function worker(wid) {
        while (true) {
            const idx = cursor++;
            if (idx >= todo.length) return;
            const p = todo[idx];
            const id = String(p.id);
            const res = await fetchPage(`${BASE}/products/${id}`);
            if (!res) {
                failed++;
                console.log(`  [w${wid}] #${id} GAGAL fetch (skip, bisa diulang run berikutnya)`);
            } else if (res.status === 404) {
                partial[id] = { hasVariants: false, variants: [], note: "404" };
            } else {
                const pd = extractProductData(res.html);
                if (!pd) {
                    noXdata++;
                    partial[id] = { hasVariants: false, variants: [], note: "no-xdata" };
                } else {
                    const variants = mapVariants(pd);
                    partial[id] = { hasVariants: variants.length > 0, variants };
                }
            }
            done++;
            if (done % 40 === 0) {
                savePartial(partial);
                const wv = Object.values(partial).filter((e) => e.variants && e.variants.length).length;
                console.log(`  progres: ${done}/${products.length} | dengan varian: ${wv} | gagal: ${failed} | no-xdata: ${noXdata}`);
            }
            await sleep(DELAY);
        }
    }

    await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i + 1)));
    savePartial(partial);

    // ---- Tulis file final (produk sesuai daftar; tanpa note internal) ----
    const out = {
        generatedAt: new Date().toISOString(),
        scanned: products.length,
        withVariants: 0,
        totalVariants: 0,
        products: {},
    };
    for (const p of products) {
        const id = String(p.id);
        const e = partial[id];
        if (!e) continue; // gagal total → tidak ditulis (akan terisi pada run berikutnya)
        const entry = { hasVariants: !!e.hasVariants, variants: e.variants ?? [] };
        out.products[id] = entry;
        if (entry.variants.length) {
            out.withVariants++;
            out.totalVariants += entry.variants.length;
        }
    }
    fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");

    console.log("\n================ RINGKASAN ================");
    console.log(`Tersimpan        : ${OUT_PATH}`);
    console.log(`Discan           : ${Object.keys(out.products).length}/${products.length}`);
    console.log(`Punya varian     : ${out.withVariants} produk`);
    console.log(`Total varian     : ${out.totalVariants}`);
    console.log(`Gagal fetch      : ${failed} (jalankan ulang untuk melengkapi)`);
    console.log(`Tanpa x-data     : ${noXdata}`);
    console.log("===========================================");
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
