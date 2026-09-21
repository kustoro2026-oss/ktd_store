/**
 * Script untuk scrape SEMUA data produk + kategori dari anekadropship.id
 * dan menyimpannya sebagai static cache JSON.
 *
 * Trigger 1 (STATIC): Jalankan script ini secara manual untuk update data.
 *   - Pakai CF_CLEARANCE cookie dari browser untuk bypass Cloudflare
 *   - Hasil: src/lib/products-cache.json (di-commit ke repo)
 *   - Site membaca dari cache ini TANPA perlu hit anekadropship
 *
 * Trigger 2 (LIVE): Set CF_CLEARANCE di Vercel env vars.
 *   - API routes akan fallback ke live scraping kalau cache ada
 *   - Buat dapetin update produk terbaru tanpa re-run script
 *
 * Usage:
 *   1. Buka anekadropship.id di Chrome, copy cf_clearance cookie
 *   2. node scripts/scrape-products-cache.cjs CF_CLEARANCE_VALUE
 *   3. Commit & push src/lib/products-cache.json
 */

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BASE = "https://anekadropship.id";
const EMAIL = process.env.ANEKA_EMAIL || "kustoroterbatas@gmail.com";
const PASSWORD = process.env.ANEKA_PASSWORD || "@$Kustores2k24";
const OUTPUT = path.join(__dirname, "..", "src", "lib", "products-cache.json");
const DELAY_MS = 1500; // longer delay to avoid rate limiting

// Cloudflare clearance dari argumen CLI atau env var
const CF_CLEARANCE = process.argv[2] || process.env.CF_CLEARANCE || "";
const CF_BM = process.env.CF_BM || "";

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function buildCookie(sessionCookie) {
    const parts = [];
    if (CF_CLEARANCE) parts.push(`cf_clearance=${CF_CLEARANCE}`);
    if (CF_BM) parts.push(`__cf_bm=${CF_BM}`);
    if (sessionCookie) parts.push(sessionCookie);
    return parts.join("; ");
}

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Full browser headers needed to bypass Cloudflare blocking.
// Without Accept-Language: id-ID, the site may serve a challenge page.
const BROWSER_HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
};

async function login() {
    let cookie = "";

    const grab = (res) => {
        const setCookies = res.headers.getSetCookie?.() ?? [];
        for (const c of setCookies) {
            const pair = c.split(";")[0];
            const name = pair.split("=")[0];
            cookie = cookie.replace(new RegExp(name + "=[^;]*;?"), "") + pair + "; ";
        }
    };

    console.log("[1/4] Login ke anekadropship...");
    const page = await fetch(`${BASE}/login`, {
        redirect: "manual",
        headers: { ...BROWSER_HEADERS, Cookie: buildCookie("") },
    });
    grab(page);
    const pageText = await page.text();
    const $ = cheerio.load(pageText);
    const token = $('input[name="_token"]').attr("value") ?? "";

    if (!token) {
        console.error("Gagal: halaman login tanpa CSRF token (Cloudflare challenge?)");
        console.error("Pastikan CF_CLEARANCE cookie masih valid.");
        process.exit(1);
    }

    const res = await fetch(`${BASE}/login`, {
        method: "POST",
        headers: {
            ...BROWSER_HEADERS,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: buildCookie(cookie),
        },
        body: new URLSearchParams({ _token: token, email: EMAIL, password: PASSWORD }),
        redirect: "manual",
    });
    grab(res);

    const location = res.headers.get("location") ?? "";
    if (res.status === 419 || (res.status >= 300 && res.status < 400 && location.includes("/login"))) {
        console.error("Login gagal: kredensial ditolak atau sesi diblokir.");
        process.exit(1);
    }

    console.log("  Login berhasil.");
    return cookie;
}

async function fetchPage(url, cookie) {
    const res = await fetch(url, {
        headers: { ...BROWSER_HEADERS, Cookie: buildCookie(cookie) },
    });
    return res.text();
}

function parseCategories(html) {
    const $ = cheerio.load(html);
    const cats = [];
    const seen = new Set();

    $('select[name="category"] option').each((_, el) => {
        const val = ($(el).attr("value") ?? "").trim();
        const name = ($(el).text() ?? "").trim();
        if (!val || val === "all" || seen.has(val)) return;
        seen.add(val);
        cats.push({ slug: val, name });
    });

    return cats;
}

function parseProducts(html, categorySlug) {
    // Skip "recommended products" section after meta_ads.png
    const adsIdx = html.indexOf("meta_ads.png");
    const resultsHtml = adsIdx >= 0 ? html.slice(0, adsIdx) : html;

    const $ = cheerio.load(resultsHtml);
    const items = [];
    const seen = new Set();

    // Same selectors as anekadropship.ts parseProducts()
    $('a.line-clamp-2[href*="/products/"]').each((_, el) => {
        const a = $(el);
        const card = a.closest("div.group");
        const href = a.attr("href") ?? "";
        const id = href.match(/\/products\/(\d+)/)?.[1] ?? "";
        const image = card.find("img").first().attr("src") ?? "";

        if (!id || seen.has(id) || !image) return;
        seen.add(id);

        // Clean price: strip " / RM XX.XX" suffix
        const cleanPrice = (raw) => {
            if (!raw) return "";
            return raw.replace(/\s*\/\s*RM\s*[\d.,]+$/i, "").trim();
        };

        // Clean product name: strip [STORE] tags
        const cleanName = (raw) => {
            let s = raw.replace(/\s+/g, " ").trim();
            s = s.replace(/^\s*(?:\[[^\]]*\]\s*)+/, "");
            s = s.replace(/\b(?:META\s*ADS(?:\s*ONLY)?|ADS\s*ONLY)\b/gi, " ");
            s = s.replace(/\s*\[[^\]]*\]\s*/g, " ");
            s = s.replace(/\s{2,}/g, " ").trim();
            return s || raw.trim();
        };

        // Use the SAME selectors as the original anekadropship.ts
        const rekomendasiJual = cleanPrice(
            card.find('span:contains("Rekomendasi Jual")')
                .parent()
                .find("span.text-green-600")
                .first()
                .text()
                .trim()
        );

        const hargaModal = cleanPrice(
            card.find("span.text-red-500").first().text().trim()
        );

        const hargaModalCut = cleanPrice(
            card.find("span.line-through").first().text().trim()
        );

        const terjual = card.find('span:contains("Terjual")')
            .parent()
            .find("span.font-bold")
            .last()
            .text()
            .trim();

        const stok = card.find('span:contains("Stok:")')
            .find("span")
            .last()
            .text()
            .trim();

        const profit = card.find("span.bg-orange-100")
            .first()
            .text()
            .trim();

        const location = card.find("div.absolute span.truncate")
            .first()
            .text()
            .trim();

        items.push({
            id,
            name: cleanName(a.text()),
            image,
            location: location || "all",
            rekomendasiJual: rekomendasiJual || "Rp -",
            hargaModal: hargaModal || "",
            hargaModalCut: hargaModalCut || "",
            terjual: terjual || "0",
            stok: stok || "0",
            profit: profit || "",
            category: categorySlug || "",
        });
    });

    return items;
}

async function main() {
    if (!CF_CLEARANCE) {
        console.warn("⚠️  CF_CLEARANCE tidak diset. Cloudflare mungkin memblokir request.");
        console.warn("    Usage: node scripts/scrape-products-cache.cjs <cf_clearance_value>");
        console.warn("    Atau set env var CF_CLEARANCE.\n");
    }

    const cookie = await login();

    // ─── Scrape categories ───────────────────────────────────────────
    console.log("[2/4] Scrape kategori...");
    await sleep(DELAY_MS);
    const homeHtml = await fetchPage(`${BASE}/user/home`, cookie);
    const categories = parseCategories(homeHtml);
    console.log(`  ${categories.length} kategori ditemukan.`);

    // ─── Scrape products (paginated) ─────────────────────────────────
    console.log("[3/4] Scrape produk (halaman 1-50)...");

    // Resume from checkpoint if exists
    let allProducts = [];
    let seenIds = new Set();
    let startPage = 1;
    const checkpointFile = OUTPUT + ".tmp";
    if (fs.existsSync(checkpointFile)) {
        try {
            const ck = JSON.parse(fs.readFileSync(checkpointFile, "utf8"));
            allProducts = ck.products || [];
            seenIds = new Set(allProducts.map((p) => p.id));
            startPage = Math.floor(allProducts.length / 10) + 1;
            console.log(`  Resuming from checkpoint: ${allProducts.length} produk, halaman ${startPage}`);
        } catch { /* ignore corrupt checkpoint */ }
    }

    for (let page = startPage; page <= 50; page++) {
        const url = `${BASE}/user/home?page=${page}&sort=newest`;
        console.log(`  Halaman ${page}...`);
        await sleep(DELAY_MS);
        const html = await fetchPage(url, cookie);

        // Check if we hit an empty page
        if (html.includes("tidak ada produk")) {
            console.log(`  Halaman ${page} kosong, berhenti.`);
            break;
        }

        const products = parseProducts(html);
        let newCount = 0;
        for (const p of products) {
            if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                allProducts.push(p);
                newCount++;
            }
        }
        console.log(`    ${newCount} produk baru (total: ${allProducts.length})`);

        // Save checkpoint every 5 pages (survives crashes / rate limiting)
        if (page % 5 === 0) {
            const checkpoint = {
                generatedAt: new Date().toISOString(),
                categories,
                products: allProducts,
            };
            fs.writeFileSync(OUTPUT + ".tmp", JSON.stringify(checkpoint, null, 2), "utf-8");
            console.log(`    💾 Checkpoint tersimpan (${allProducts.length} produk)`);
        }

        if (products.length < 5) break; // less than 5 = likely last page
    }

    // ─── Scrape Malaysia products ────────────────────────────────────
    console.log("[3.5/4] Scrape produk Malaysia...");
    let malaysiaCount = 0;
    for (let page = 1; page <= 10; page++) {
        const url = `${BASE}/produk/semua/malaysia?page=${page}`;
        console.log(`  Malaysia halaman ${page}...`);
        await sleep(DELAY_MS);
        try {
            const html = await fetchPage(url, cookie);
            if (html.includes("tidak ada produk")) {
                console.log(`  Halaman ${page} kosong, berhenti.`);
                break;
            }
            const products = parseProducts(html, "malaysia");
            let newCount = 0;
            for (const p of products) {
                if (!seenIds.has(p.id)) {
                    seenIds.add(p.id);
                    allProducts.push(p);
                    newCount++;
                }
            }
            malaysiaCount += newCount;
            console.log(`    ${newCount} produk baru (total: ${allProducts.length})`);
            if (products.length < 5) break;
        } catch (e) {
            console.log(`    Gagal: ${e.message}`);
            break;
        }
    }
    console.log(`  Total produk Malaysia: ${malaysiaCount}`);

    // ─── Save ────────────────────────────────────────────────────────
    console.log(`[4/4] Menyimpan ${allProducts.length} produk + ${categories.length} kategori...`);
    const cache = {
        generatedAt: new Date().toISOString(),
        categories,
        products: allProducts,
    };

    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, JSON.stringify(cache, null, 2), "utf-8");
    // Clean up checkpoint
    try { fs.unlinkSync(OUTPUT + ".tmp"); } catch { }
    console.log(`  Tersimpan ke ${OUTPUT}`);
    console.log("\n✅ Selesai! Commit & push products-cache.json untuk deploy.");
}

main().catch((err) => {
    console.error("FATAL:", err.message || err);
    process.exit(1);
});