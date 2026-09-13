/**
 * Script untuk mengumpulkan SEMUA produk dari anekadropship.id dan link marketing kit-nya.
 *
 * Strategi: Iterasi semua kategori, paginate per kategori, deduplikasi.
 *
 * Fase 1: Dapatkan semua kategori, lalu scrape semua halaman per kategori
 * Fase 2: Untuk setiap produk unik, ambil link Google Drive marketing kit
 *
 * Output: scripts/marketing-kit-links-all.json
 *
 * Usage: node scripts/scrape-all-marketing-links.cjs
 */

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BASE = "https://anekadropship.id";
const EMAIL = "kustoroterbatas@gmail.com";
const PASSWORD = "@$Kustores2k24";
const OUT_PATH = path.join(__dirname, "marketing-kit-links-all.json");
const DELAY_LIST = 300;    // Jeda antar halaman listing
const DELAY_PRODUCT = 400; // Jeda antar produk (detail page)

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function cleanProductName(raw) {
    let s = raw.replace(/\s+/g, " ").trim();
    s = s.replace(/^\s*(?:\[[^\]]*\]\s*)+/, "");
    s = s.replace(/\b(?:META\s*ADS(?:\s*ONLY)?|ADS\s*ONLY)\b/gi, " ");
    s = s.replace(/\s*\[[^\]]*\]\s*/g, " ");
    s = s.replace(/\s*\[[^\]]*[}\]]\s*/g, " ");
    s = s.replace(/\s{2,}/g, " ").trim();
    return s || raw.trim();
}

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

    console.log("Login ke anekadropship...");
    const page = await fetch(BASE + "/login", { redirect: "manual" });
    grab(page);
    const pageText = await page.text();
    const $ = cheerio.load(pageText);
    const token = $('input[name="_token"]').attr("value") ?? "";

    if (!token) throw new Error("Gagal mendapatkan CSRF token");

    const res = await fetch(BASE + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
        body: new URLSearchParams({ _token: token, email: EMAIL, password: PASSWORD }),
        redirect: "manual",
    });
    grab(res);

    const location = res.headers.get("location") ?? "";
    if (res.status === 419 || (res.status >= 300 && res.status < 400 && location.includes("/login"))) {
        throw new Error("Login gagal");
    }
    console.log("Login berhasil!");
    return cookie;
}

/**
 * Dapatkan daftar semua kategori dari dropdown filter
 */
async function getCategories(cookie) {
    const res = await fetch(BASE + "/user/home", {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(20000),
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const cats = [];
    $('select[name="category"] option').each((_, el) => {
        const value = $(el).attr("value") ?? "";
        if (value && value !== "all") cats.push(value);
    });
    return cats;
}

/**
 * Fase 1: Discover semua produk dengan iterasi semua kategori
 */
async function discoverAllProducts(cookie) {
    console.log("\n=== FASE 1: Discover semua produk ===\n");

    // Dapatkan kategori
    const categories = await getCategories(cookie);
    console.log(`Kategori ditemukan: ${categories.length}`);
    console.log(`Kategori: ${categories.join(", ")}\n`);

    const allProducts = {};
    let totalFound = 0;

    for (let ci = 0; ci < categories.length; ci++) {
        const cat = categories[ci];
        console.log(`[Kategori ${ci + 1}/${categories.length}] ${cat}`);

        let page = 1;
        let emptyPages = 0;
        let catFound = 0;

        while (true) {
            const url = `${BASE}/user/home?search=&category=${encodeURIComponent(cat)}&location=all&seller=all&page=${page}`;

            let html;
            try {
                const res = await fetch(url, {
                    headers: { Cookie: cookie },
                    signal: AbortSignal.timeout(20000),
                });
                html = await res.text();
            } catch (err) {
                console.log(`  Error halaman ${page}: ${err.message}, skip kategori ini.`);
                break;
            }

            if (html.includes("Login ke akun Anda")) {
                console.log("  Session expired, re-login...");
                cookie = await login();
                continue;
            }

            const $ = cheerio.load(html);
            let foundOnPage = 0;

            $('a.line-clamp-2[href*="/products/"]').each((_, el) => {
                const href = $(el).attr("href") ?? "";
                const id = href.match(/\/products\/(\d+)/)?.[1] ?? "";
                if (!id || allProducts[id]) return;
                const name = cleanProductName($(el).text());
                allProducts[id] = { id, name, marketingKitUrl: null };
                foundOnPage++;
            });

            catFound += foundOnPage;
            totalFound += foundOnPage;

            if (foundOnPage === 0) {
                emptyPages++;
                if (emptyPages >= 2) break;
            } else {
                emptyPages = 0;
            }

            page++;
            await sleep(DELAY_LIST);
        }

        console.log(`  -> ${catFound} produk dari kategori ini (total unik: ${totalFound})`);
    }

    const products = Object.values(allProducts);
    console.log(`\nTotal produk unik ditemukan: ${products.length}`);
    return { products, cookie };
}

/**
 * Fase 2: Scrape marketing kit links
 */
async function scrapeMarketingLinks(products, cookie) {
    console.log(`\n=== FASE 2: Scrape marketing kit links untuk ${products.length} produk ===\n`);

    let withLink = 0;
    let withoutLink = 0;
    let errors = 0;

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const progress = `[${String(i + 1).padStart(4)}/${products.length}]`;

        try {
            const res = await fetch(BASE + "/products/" + p.id, {
                headers: { Cookie: cookie },
                signal: AbortSignal.timeout(20000),
            });

            if (res.status === 302) {
                cookie = await login();
                const retryRes = await fetch(BASE + "/products/" + p.id, {
                    headers: { Cookie: cookie },
                    signal: AbortSignal.timeout(20000),
                });
                const retryHtml = await retryRes.text();
                const retry$ = cheerio.load(retryHtml);
                p.marketingKitUrl = retry$('a[href*="drive.google.com"]').first().attr("href") ?? null;
            } else {
                const html = await res.text();
                const $ = cheerio.load(html);
                p.marketingKitUrl = $('a[href*="drive.google.com"]').first().attr("href") ?? null;
            }

            if (p.marketingKitUrl) {
                withLink++;
                console.log(`${progress} ID:${p.id} | ${p.name.substring(0, 50)} | LINK`);
            } else {
                withoutLink++;
                console.log(`${progress} ID:${p.id} | ${p.name.substring(0, 50)} | TIDAK ADA`);
            }
        } catch (err) {
            errors++;
            console.log(`${progress} ID:${p.id} | ERROR: ${err.message}`);
        }

        if ((i + 1) % 100 === 0) {
            fs.writeFileSync(OUT_PATH, JSON.stringify(products, null, 2), "utf8");
            console.log(`  --- Progress disimpan (${i + 1}/${products.length}) ---`);
        }

        await sleep(DELAY_PRODUCT);
    }

    console.log(`\n========================================`);
    console.log(`SELESAI!`);
    console.log(`Total: ${products.length} | Link: ${withLink} | Tanpa: ${withoutLink} | Error: ${errors}`);

    return products;
}

async function main() {
    let cookie = await login();
    const { products, cookie: cookie2 } = await discoverAllProducts(cookie);
    cookie = cookie2;

    // Simpan hasil discover
    fs.writeFileSync(OUT_PATH, JSON.stringify(products, null, 2), "utf8");
    console.log(`Hasil discover disimpan di: ${OUT_PATH}`);

    // Fase 2
    const finalProducts = await scrapeMarketingLinks(products, cookie);
    fs.writeFileSync(OUT_PATH, JSON.stringify(finalProducts, null, 2), "utf8");
    console.log(`Hasil akhir disimpan di: ${OUT_PATH}`);
}

main().catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
});