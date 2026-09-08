// Optimasi gambar produk: konversi png/jpg/gif/avif -> webp (maks 1600px, q82)
// lalu perbarui src/lib/product-images.json agar ekstensi mengikuti file baru.
// File yang hasil konversinya tidak lebih kecil dibiarkan dalam format asli.
// Jalankan: node scripts/optimize-product-images.mjs
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

const DIR = path.join(process.cwd(), "public", "images", "products");
const MAPPING_PATH = path.join(process.cwd(), "src", "lib", "product-images.json");
const EXT_RE = /\.(png|jpe?g|gif|avif)$/i;

const files = (await fs.readdir(DIR)).filter((f) => EXT_RE.test(f));
console.log(`Ditemukan ${files.length} file non-webp yang akan dikonversi...`);

let converted = 0;
let failed = 0;
let savedBytes = 0;

for (const f of files) {
  const src = path.join(DIR, f);
  const dest = src.replace(EXT_RE, ".webp");
  try {
    const { size: inSize } = await fs.stat(src);
    await sharp(src)
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(dest);
    const { size: outSize } = await fs.stat(dest);
    if (outSize > 0 && outSize < inSize) {
      await fs.unlink(src);
      savedBytes += inSize - outSize;
      converted++;
    } else {
      // webp tidak lebih kecil — pertahankan file asli, buang hasil konversi.
      await fs.unlink(dest);
    }
    if (converted % 200 === 0 && converted > 0) {
      console.log(`  ${converted}/${files.length} dikonversi...`);
    }
  } catch (e) {
    failed++;
    console.error(`  gagal: ${f} — ${e.message}`);
  }
}

// Perbarui mapping: arahkan ke .webp hanya bila file hasil konversi ada.
const exists = async (p) => {
  try {
    return (await fs.stat(p)).size > 0;
  } catch {
    return false;
  }
};
const mapping = JSON.parse(await fs.readFile(MAPPING_PATH, "utf8"));
for (const [id, paths] of Object.entries(mapping)) {
  mapping[id] = await Promise.all(
    paths.map(async (p) => {
      if (!EXT_RE.test(p)) return p;
      const alt = p.replace(EXT_RE, ".webp");
      return (await exists(path.join(process.cwd(), "public", alt))) ? alt : p;
    }),
  );
}
await fs.writeFile(MAPPING_PATH, JSON.stringify(mapping, null, 2) + "\n", "utf8");

console.log(
  `Selesai: ${converted} dikonversi, ${failed} gagal, hemat ${(savedBytes / 1e6).toFixed(0)} MB`,
);
