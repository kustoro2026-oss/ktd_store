/**
 * Script untuk mengumpulkan link marketing kit (Google Drive) dari SEMUA produk anekadropship.id.
 *
 * Output: scripts/marketing-kit-links.json
 * Format: [{ id, name, marketingKitUrl }]
 *
 * Usage: node scripts/scrape-marketing-links.cjs
 */

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BASE = "https://anekadropship.id";
const EMAIL = "kustoroterbatas@gmail.com";
const PASSWORD = "@$Kustores2k24";
const MAPPING_PATH = path.join(__dirname, "..", "src", "lib", "product-images.json");
const OUT_PATH = path.join(__dirname, "marketing-kit-links.json");
const DELAY_MS = 600; // Jeda antar produk (hindari throttle)

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

async function main() {
    // Baca daftar produk
    const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, "utf8"));
    const productIds = Object.keys(mapping);
    console.log(`Total produk: ${productIds.length}`);

    // Login ke anekadropship
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

    if (!token) {
        console.error("Gagal mendapatkan CSRF token. Mungkin kena Cloudflare challenge.");
        process.exit(1);
    }

    const res = await fetch(BASE + "/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: cookie,
        },
        body: new URLSearchParams({ _token: token, email: EMAIL, password: PASSWORD }),
        redirect: "manual",
    });
    grab(res);

    const location = res.headers.get("location") ?? "";
    if (res.status === 419 || (res.status >= 300 && res.status < 400 && location.includes("/login"))) {
        console.error("Login gagal. Periksa kredensial.");
        process.exit(1);
    }
    console.log("Login berhasil!\n");

    // Proses setiap produk
    const results = [];
    let withLink = 0;
    let withoutLink = 0;
    let errors = 0;

    for (let i = 0; i < productIds.length; i++) {
        const id = productIds[i];
        const progress = `[${String(i + 1).padStart(3)}/${productIds.length}]`;

        try {
            const prodRes = await fetch(BASE + "/products/" + id, {
                headers: { Cookie: cookie },
                redirect: "manual",
            });

            if (prodRes.status === 302) {
                // Session expired, re-login
                console.log(`  ${progress} Session expired, re-login...`);
                cookie = "";
                const rePage = await fetch(BASE + "/login", { redirect: "manual" });
                grab(rePage);
                const reText = await rePage.text();
                const re$ = cheerio.load(reText);
                const reToken = re$('input[name="_token"]').attr("value") ?? "";
                const reRes = await fetch(BASE + "/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        Cookie: cookie,
                    },
                    body: new URLSearchParams({ _token: reToken, email: EMAIL, password: PASSWORD }),
                    redirect: "manual",
                });
                grab(reRes);
                // Retry product fetch
                const retryRes = await fetch(BASE + "/products/" + id, {
                    headers: { Cookie: cookie },
                    redirect: "manual",
                });
                const retryHtml = await retryRes.text();
                const retry$ = cheerio.load(retryHtml);
                const name = cleanProductName(retry$("h1").first().text());
                const driveLink = retry$('a[href*="drive.google.com"]').first().attr("href") ?? null;
                results.push({ id, name, marketingKitUrl: driveLink });
                if (driveLink) {
                    withLink++;
                    console.log(`${progress} ID:${id} | ${name.substring(0, 60)} | LINK: ${driveLink}`);
                } else {
                    withoutLink++;
                    console.log(`${progress} ID:${id} | ${name.substring(0, 60)} | TIDAK ADA LINK`);
                }
            } else {
                const html = await prodRes.text();
                const $2 = cheerio.load(html);
                const name = cleanProductName($2("h1").first().text());
                const driveLink = $2('a[href*="drive.google.com"]').first().attr("href") ?? null;
                results.push({ id, name, marketingKitUrl: driveLink });
                if (driveLink) {
                    withLink++;
                    console.log(`${progress} ID:${id} | ${name.substring(0, 60)} | LINK: ${driveLink}`);
                } else {
                    withoutLink++;
                    console.log(`${progress} ID:${id} | ${name.substring(0, 60)} | TIDAK ADA LINK`);
                }
            }
        } catch (err) {
            errors++;
            console.log(`${progress} ID:${id} | ERROR: ${err.message}`);
            results.push({ id, name: "ERROR", marketingKitUrl: null });
        }

        // Simpan progress setiap 50 produk
        if ((i + 1) % 50 === 0) {
            fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2), "utf8");
            console.log(`  --- Progress disimpan (${i + 1}/${productIds.length}) ---`);
        }

        await sleep(DELAY_MS);
    }

    // Simpan hasil akhir
    fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2), "utf8");

    console.log(`\n========================================`);
    console.log(`SELESAI!`);
    console.log(`Total produk: ${productIds.length}`);
    console.log(`Dengan link marketing kit: ${withLink}`);
    console.log(`Tanpa link: ${withoutLink}`);
    console.log(`Error: ${errors}`);
    console.log(`Hasil disimpan di: ${OUT_PATH}`);
}

main().catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
});