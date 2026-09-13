/**
 * Script untuk mengunduh marketing kit dari Google Drive untuk semua produk.
 *
 * Cara kerja:
 * 1. Baca daftar produk dari src/lib/product-images.json
 * 2. Login ke anekadropship.id
 * 3. Untuk setiap produk, ambil halaman detail & ekstrak link Google Drive
 * 4. Download folder Google Drive ke public/marketing-kit/{productId}/
 *
 * Usage: node scripts/download-marketing-kit.cjs
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const cheerio = require("cheerio");

const BASE = "https://anekadropship.id";
const EMAIL = "kustoroterbatas@gmail.com";
const PASSWORD = "@$Kustores2k24";
const MAPPING_PATH = path.join(__dirname, "..", "src", "lib", "product-images.json");
const OUT_DIR = path.join(__dirname, "..", "public", "marketing-kit");
const DELAY_MS = 800; // Jeda antar produk (hindari throttle)

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function main() {
    // Baca daftar produk
    const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, "utf8"));
    const productIds = Object.keys(mapping);
    console.log(`Total produk: ${productIds.length}`);

    // Buat folder output
    fs.mkdirSync(OUT_DIR, { recursive: true });

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
        console.error("Login gagal. Periksa kredensial di .env.local");
        process.exit(1);
    }
    console.log("Login berhasil!");

    // Proses setiap produk
    let downloaded = 0;
    let skipped = 0;
    let noLink = 0;
    let failed = 0;

    for (let i = 0; i < productIds.length; i++) {
        const id = productIds[i];
        const productDir = path.join(OUT_DIR, id);

        // Skip jika sudah ada
        if (fs.existsSync(productDir) && fs.readdirSync(productDir).length > 0) {
            skipped++;
            console.log(`[${i + 1}/${productIds.length}] ${id} - SUDAH ADA (skip)`);
            continue;
        }

        try {
            // Ambil halaman detail produk
            const prodRes = await fetch(BASE + "/products/" + id, {
                headers: { Cookie: cookie },
                redirect: "manual",
            });

            if (prodRes.status === 302) {
                // Session expired, re-login
                console.log("  Session expired, re-login...");
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
                const driveLink = retry$('a[href*="drive.google.com"]').first().attr("href") ?? null;
                await processProduct(id, driveLink, productDir, i, productIds.length);
            } else {
                const html = await prodRes.text();
                const $2 = cheerio.load(html);
                const driveLink = $2('a[href*="drive.google.com"]').first().attr("href") ?? null;
                await processProduct(id, driveLink, productDir, i, productIds.length);
            }
        } catch (err) {
            failed++;
            console.log(`[${i + 1}/${productIds.length}] ${id} - ERROR: ${err.message}`);
        }

        // Jeda antar produk
        await sleep(DELAY_MS);
    }

    console.log(`\nSelesai!`);
    console.log(`  Diunduh: ${downloaded}`);
    console.log(`  Dilewati (sudah ada): ${skipped}`);
    console.log(`  Tanpa link: ${noLink}`);
    console.log(`  Gagal: ${failed}`);

    async function processProduct(id, driveLink, productDir, idx, total) {
        if (!driveLink) {
            noLink++;
            console.log(`[${idx + 1}/${total}] ${id} - TIDAK ADA LINK`);
            return;
        }

        console.log(`[${idx + 1}/${total}] ${id} - Download: ${driveLink}`);

        // Buat folder produk
        fs.mkdirSync(productDir, { recursive: true });

        try {
            // Gunakan gdown untuk download folder
            const cmd = `python -c "import gdown, sys; files = gdown.download_folder('${driveLink}', quiet=True, output='${productDir.replace(/\\/g, "\\\\")}'); print('OK:' + str(len(files)) if files else 'EMPTY')"`;
            const result = execSync(cmd, {
                cwd: productDir,
                timeout: 120_000,
                encoding: "utf8",
            });
            console.log(`  -> ${result.trim()}`);
            downloaded++;
        } catch (err) {
            // gdown mungkin gagal untuk beberapa folder
            const stderr = err.stderr || err.message || "";
            if (stderr.includes("No file") || stderr.includes("empty")) {
                console.log(`  -> Folder kosong atau tidak bisa diakses`);
                noLink++;
            } else {
                console.log(`  -> Gagal: ${stderr.substring(0, 100)}`);
                failed++;
            }
        }
    }
}

main().catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
});