// Analisis varian dari hasil audit: cek apakah harga varian konsisten dengan
// "Rekomendasi Jual" anekadropship.
import * as fs from "node:fs";
import * as path from "node:path";

const details = JSON.parse(
  fs.readFileSync(path.resolve("tiktok-export/audit-harga-progress.json"), "utf8")
) as Record<string, { jual: string; modal: string; jualNum: number; modalNum: number; variants: { name: string; price: string }[] }>;

const toNum = (s: string) => {
  const n = parseInt(String(s ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

let withVariants = 0;
let variantPriceDiffers = 0;
let variantPriceEmpty = 0;
const samples: string[] = [];

for (const [id, d] of Object.entries(details)) {
  if (!d.variants.length) continue;
  withVariants++;
  const prices = d.variants.map((v) => toNum(v.price)).filter(Boolean);
  if (!prices.length) {
    variantPriceEmpty++;
    samples.push(`[${id}] jual=${d.jual} varian tanpa harga: ${d.variants.map((v) => v.name).slice(0, 3).join(", ")}`);
    continue;
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min !== d.jualNum || max !== d.jualNum) {
    variantPriceDiffers++;
    if (samples.length < 25) {
      samples.push(
        `[${id}] jual=${d.jual} varian=${d.variants
          .slice(0, 5)
          .map((v) => `${v.name}=${v.price}`)
          .join(", ")}`
      );
    }
  }
}

console.log(`Produk dengan varian: ${withVariants}/${Object.keys(details).length}`);
console.log(`Varian dengan harga kosong: ${variantPriceEmpty}`);
console.log(`Harga varian berbeda dari Rekomendasi Jual: ${variantPriceDiffers}`);
console.log("\nContoh:");
for (const s of samples) console.log("  " + s);
