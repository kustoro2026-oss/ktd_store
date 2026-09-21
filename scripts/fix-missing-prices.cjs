/**
 * Scrape individual product detail pages to fill in missing prices.
 * Usage: node scripts/fix-missing-prices.cjs
 */
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BASE = "https://anekadropship.id";
const CACHE_PATH = path.join(__dirname, "..", "src", "lib", "products-cache.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const H = { "User-Agent": UA, "Accept": "text/html", "Accept-Language": "id-ID,id;q=0.9" };

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

    console.log("Login...");
    const page = await fetch(`${BASE}/login`, { redirect: "manual", headers: H });
    grab(page);
    const $ = cheerio.load(await page.text());
    const token = $('input[name="_token"]').attr("value") ?? "";
    if (!token) throw new Error("No CSRF token");

    const res = await fetch(`${BASE}/login`, {
        method: "POST",
        headers: { ...H, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
        body: new URLSearchParams({ _token: token, email: "kustoroterbatas@gmail.com", password: "@$Kustores2k24" }),
        redirect: "manual",
    });
    grab(res);
    console.log("Login OK");
    return cookie;
}

function cleanPrice(raw) {
    if (!raw) return "";
    return raw.replace(/\s*\/\s*RM\s*[\d.,]+$/i, "").trim();
}

async function scrapeDetail(id, cookie) {
    const url = `${BASE}/products/${id}`;
    const res = await fetch(url, { headers: { ...H, Cookie: cookie } });
    const html = await res.text();
    const $ = cheerio.load(html);

    // Price from detail page: the main "Rekomendasi Jual" is in strong.text-emerald-600
    let price = $("strong.text-emerald-600").first().text().trim();
    if (price) return cleanPrice(price);

    // Fallback: find any Rp price in a strong tag
    price = $("strong").filter((_, el) => /^Rp\s*[\d.,]+/.test($(el).text().trim())).first().text().trim();
    if (price) return cleanPrice(price);

    // Last resort: any Rp text
    let found = "";
    $("span, strong, p").each((_, el) => {
        const t = $(el).text().trim();
        if (/^Rp\s*[\d.,]+/.test(t) && !found) found = t;
    });
    return cleanPrice(found);
}

async function main() {
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    const missing = cache.products.filter((p) => !p.rekomendasiJual || p.rekomendasiJual === "Rp -");

    if (missing.length === 0) {
        console.log("All products have prices!");
        return;
    }

    console.log(`${missing.length} products without prices. Scraping individually...`);

    const cookie = await login();
    let fixed = 0;

    for (let i = 0; i < missing.length; i++) {
        const p = missing[i];
        console.log(`[${i + 1}/${missing.length}] ID:${p.id} ${p.name.substring(0, 40)}...`);
        await sleep(800);

        try {
            const price = await scrapeDetail(p.id, cookie);
            if (price) {
                // Update in the main products array
                const idx = cache.products.findIndex((x) => x.id === p.id);
                if (idx >= 0) {
                    cache.products[idx].rekomendasiJual = price;
                    fixed++;
                    console.log(`  -> ${price}`);
                }
            } else {
                console.log(`  -> No price found`);
            }
        } catch (e) {
            console.log(`  -> Error: ${e.message}`);
        }
    }

    cache.generatedAt = new Date().toISOString();
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
    console.log(`\nFixed ${fixed}/${missing.length} products. Saved.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });