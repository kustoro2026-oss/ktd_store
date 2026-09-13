/**
 * Script untuk memperbaiki product-images.json — menghapus gambar "Produk Terkait"
 * yang ikut tersimpan saat sinkronisasi lama.
 *
 * Cara kerja:
 * 1. Baca product-images.json
 * 2. Untuk setiap produk, scrape halaman detail (dengan fix terbaru)
 * 3. Bandingkan jumlah gambar — jika berbeda, update JSON
 * 4. Hapus file gambar ekstra dari public/images/products/
 *
 * Usage: node scripts/fix-product-images.cjs
 */

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BASE = "https://anekadropship.id";
const EMAIL = "kustoroterbatas@gmail.com";
const PASSWORD = "@$Kustores2k24";
const MAPPING_PATH = path.join(__dirname, "..", "src", "lib", "product-images.json");
const IMAGES_DIR = path.join(__dirname, "..", "public", "images", "products");
const DELAY_MS = 500;

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function main() {
    const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, "utf8"));
    const productIds = Object.keys(mapping);
    console.log(`Total produk: ${productIds.length}`);

    // Login
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
    const page = await fetch(BASE + "/login", { redirect: "manual" });
    grab(page);
    const pageText = await page.text();
    const $ = cheerio.load(pageText);
    const token = $('input[name="_token"]').attr("value") ?? "";
    if (!token) {
        console.error("Gagal dapat CSRF token");
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
    console.log("Login OK");

    let fixed = 0;
    let same = 0;
    let failed = 0;

    for (let i = 0; i < productIds.length; i++) {
        const id = productIds[i];
        const cachedImages = mapping[id] || [];

        try {
            const prodRes = await fetch(BASE + "/products/" + id, {
                headers: { Cookie: cookie },
                redirect: "manual",
            });

            if (prodRes.status === 302) {
                // Re-login
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
                continue; // Skip this product, will be fixed on next run
            }

            const html = await prodRes.text();
            const $2 = cheerio.load(html);

            // Gunakan selector yang sama dengan parseProductDetail (fix terbaru)
            const productCard = $2(".bg-white.rounded-xl.shadow-md").first();
            const galleryScope = productCard.length ? productCard : $2("body");
            const scrapedUrls = [];
            galleryScope.find('img[src*="/uploads/products"]').each((_, el) => {
                const src = $2(el).attr("src") ?? "";
                if (src && !scrapedUrls.includes(src)) scrapedUrls.push(src);
            });

            const correctCount = scrapedUrls.length;
            const cachedCount = cachedImages.length;

            if (correctCount === cachedCount) {
                same++;
                if (i % 20 === 0) console.log(`[${i + 1}/${productIds.length}] ${id} - OK (${cachedCount} images)`);
            } else {
                // Update mapping
                mapping[id] = cachedImages.slice(0, correctCount);

                // Hapus file gambar ekstra
                const extraImages = cachedImages.slice(correctCount);
                for (const imgPath of extraImages) {
                    const fullPath = path.join(__dirname, "..", "public", imgPath);
                    try {
                        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                    } catch { }
                }

                fixed++;
                console.log(`[${i + 1}/${productIds.length}] ${id} - FIXED: ${cachedCount} -> ${correctCount} images`);
            }
        } catch (err) {
            failed++;
            console.log(`[${i + 1}/${productIds.length}] ${id} - ERROR: ${err.message}`);
        }

        await sleep(DELAY_MS);
    }

    // Simpan mapping
    const sorted = {};
    for (const k of Object.keys(mapping).sort((a, b) => Number(a) - Number(b))) {
        sorted[k] = mapping[k];
    }
    fs.writeFileSync(MAPPING_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");

    console.log(`\nSelesai! Fixed: ${fixed}, Same: ${same}, Failed: ${failed}`);
}

main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
});