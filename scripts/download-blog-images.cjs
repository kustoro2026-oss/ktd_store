// Download blog images from Unsplash to /public/images/blog/
const https = require("https");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "public", "images", "blog");

const images = [
    ["peralatan-rumah-tangga.jpg", "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=450&fit=crop"],
    ["alat-kebersihan.jpg", "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=800&h=450&fit=crop"],
    ["suplemen-ikan.jpg", "https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=800&h=450&fit=crop"],
    ["vitamin-hewan.jpg", "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800&h=450&fit=crop"],
    ["skincare.jpg", "https://images.unsplash.com/photo-1570194065650-d99fb4ee8e39?w=800&h=450&fit=crop"],
    ["parfum.jpg", "https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&h=450&fit=crop"],
    ["herbal.jpg", "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=800&h=450&fit=crop"],
    ["alat-kesehatan.jpg", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=450&fit=crop"],
    ["elektronik.jpg", "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&h=450&fit=crop"],
    ["sepatu-wanita.jpg", "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&h=450&fit=crop"],
    ["aksesoris.jpg", "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=800&h=450&fit=crop"],
    ["makanan-sehat.jpg", "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=450&fit=crop"],
    ["mainan-edukasi.jpg", "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800&h=450&fit=crop"],
    ["hobi-kreatif.jpg", "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=450&fit=crop"],
    ["sparepart.jpg", "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=450&fit=crop"],
    ["aksesoris-motor.jpg", "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&h=450&fit=crop"],
    ["pupuk.jpg", "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=450&fit=crop"],
    ["pestisida.jpg", "https://images.unsplash.com/photo-1590055531615-f26d2e5f0b6d?w=800&h=450&fit=crop"],
    ["desinfektan.jpg", "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=800&h=450&fit=crop"],
];

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400) {
                // Follow redirect
                https.get(res.headers.location, (r2) => {
                    r2.pipe(file);
                    file.on("finish", () => { file.close(); resolve(); });
                });
                return;
            }
            res.pipe(file);
            file.on("finish", () => { file.close(); resolve(); });
        }).on("error", reject);
    });
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    for (const [name, url] of images) {
        const dest = path.join(OUT, name);
        if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
            console.log(`SKIP ${name} (already exists)`);
            continue;
        }
        try {
            await download(url, dest);
            console.log(`OK   ${name}`);
        } catch (e) {
            console.error(`FAIL ${name}: ${e.message}`);
        }
    }
    console.log("Done!");
}

main();