/**
 * Script untuk scrape SEMUA gambar produk dari anekadropship.id dan download ke lokal.
 *
 * Cara kerja:
 * 1. Baca daftar 428 produk dari marketing-kit-links-all.json
 * 2. Untuk setiap produk, scrape halaman detail & ekstrak URL gambar
 * 3. Download gambar yang belum ada ke public/images/products/
 * 4. Update src/lib/product-images.json
 *
 * Usage: node scripts/scrape-all-product-images.cjs
 */

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BASE = "https://anekadropship.id";
const EMAIL = "kustoroterbatas@gmail.com";
const PASSWORD = "@$Kustores2k24";
const PRODUCTS_LIST = path.join(__dirname, "marketing-kit-links-all.json");
const MAPPING_PATH = path.join(__dirname, "..", "src", "lib", "product-images.json");
const IMAGES_DIR = path.join(__dirname, "..", "public", "images", "products");
const DELAY_MS = 400;

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
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
 * Download file dari URL ke path lokal. Skip jika sudah ada.
 */
async function downloadImage(url, destPath) {
    if (fs.existsSync(destPath)) {
        return "skipped";
    }

    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) return "failed";
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(destPath, buffer);
        return "downloaded";
    } catch {
        return "failed";
    }
}

async function main() {
    // Baca daftar produk
    const products = JSON.parse(fs.readFileSync(PRODUCTS_LIST, "utf8"));
    console.log(`Total produk: ${products.length}`);

    // Baca mapping existing
    let mapping = {};
    try {
        mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, "utf8"));
    } catch {
        console.log("product-images.json tidak ditemukan, membuat baru.");
    }

    // Buat folder images
    fs.mkdirSync(IMAGES_DIR, { recursive: true });

    // Login
    let cookie = await login();

    let totalImages = 0;
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;
    let errors = 0;

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const progress = `[${String(i + 1).padStart(3)}/${products.length}]`;

        try {
            // Fetch halaman detail
            const res = await fetch(BASE + "/products/" + p.id, {
                headers: { Cookie: cookie },
                signal: AbortSignal.timeout(20000),
            });

            if (res.status === 302) {
                cookie = await login();
                continue; // retry next iteration
            }

            const html = await res.text();
            const $ = cheerio.load(html);

            // Ekstrak URL gambar (selector sama dengan parseProductDetail)
            const productCard = $(".bg-white.rounded-xl.shadow-md").first();
            const galleryScope = productCard.length ? productCard : $("body");
            const imageUrls = [];
            galleryScope.find('img[src*="/uploads/products"]').each((_, el) => {
                const src = $(el).attr("src") ?? "";
                if (src && !imageUrls.includes(src)) imageUrls.push(src);
            });

            if (imageUrls.length === 0) {
                console.log(`${progress} ID:${p.id} | 0 gambar (mungkin produk dihapus)`);
                continue;
            }

            // Download setiap gambar
            const localPaths = [];
            for (let j = 0; j < imageUrls.length; j++) {
                const url = imageUrls[j];
                // Tentukan ekstensi dari URL atau default .webp
                const extMatch = url.match(/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i);
                const ext = extMatch ? extMatch[1].toLowerCase() : "webp";
                const filename = `${p.id}-${j}.${ext}`;
                const destPath = path.join(IMAGES_DIR, filename);
                const localPath = `/images/products/${filename}`;

                const result = await downloadImage(url, destPath);
                if (result === "downloaded") downloaded++;
                else if (result === "skipped") skipped++;
                else failed++;

                localPaths.push(localPath);
                totalImages++;
            }

            // Update mapping
            mapping[p.id] = localPaths;

            const status = imageUrls.length === 1
                ? `1 gambar`
                : `${imageUrls.length} gambar`;
            console.log(`${progress} ID:${p.id} | ${p.name.substring(0, 40)} | ${status}`);

        } catch (err) {
            errors++;
            console.log(`${progress} ID:${p.id} | ERROR: ${err.message}`);
        }

        // Simpan progress setiap 50 produk
        if ((i + 1) % 50 === 0) {
            const sorted = {};
            for (const k of Object.keys(mapping).sort((a, b) => Number(a) - Number(b))) {
                sorted[k] = mapping[k];
            }
            fs.writeFileSync(MAPPING_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");
            console.log(`  --- Progress disimpan (${i + 1}/${products.length}) | Total gambar: ${totalImages} ---`);
        }

        await sleep(DELAY_MS);
    }

    // Simpan final
    const sorted = {};
    for (const k of Object.keys(mapping).sort((a, b) => Number(a) - Number(b))) {
        sorted[k] = mapping[k];
    }
    fs.writeFileSync(MAPPING_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");

    console.log(`\n========================================`);
    console.log(`SELESAI!`);
    console.log(`Produk diproses: ${products.length}`);
    console.log(`Total gambar: ${totalImages}`);
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Skipped (sudah ada): ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log(`Errors: ${errors}`);
    console.log(`Mapping disimpan di: ${MAPPING_PATH}`);
}

main().catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
});