/**
 * Debug: ekstrak JSON varian dari x-data productActionDetail di _1542.html.
 * Jalankan: node scripts/parse-1542.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

const h = fs.readFileSync(path.resolve("tiktok-export/_1542.html"), "utf8");
const start = h.indexOf("x-data=\"productActionDetail(");
if (start < 0) {
  console.error("x-data productActionDetail tidak ditemukan");
  process.exit(1);
}
const s = start + "x-data=\"productActionDetail(".length;
// temukan kutip penutup x-data (kutip ganda setelah json)
const end = h.indexOf('"', s + 1);
const raw = h.slice(s, end);
console.log("panjang mentah:", raw.length);
try {
  const clean = raw.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  // format: paymentId, productId, {...productData...}
  const braceStart = clean.indexOf("{");
  const braceEnd = clean.lastIndexOf("}");
  const productData = JSON.parse(clean.slice(braceStart, braceEnd + 1));
  console.log("nama:", productData.name);
  console.log("has_variants:", productData.has_variants, "| jumlah varian:", (productData.variants ?? []).length);
  const variants = productData.variants ?? [];
  console.log("contoh varian:", JSON.stringify(variants.slice(0, 3), null, 1));
  const names = [...new Set(variants.map((v: any) => v.name))];
  const colors = [...new Set(variants.map((v: any) => v.color).filter((x: any) => x))];
  const sizes = [...new Set(variants.map((v: any) => v.size).filter((x: any) => x))];
  console.log("axis name:", names.slice(0, 15), names.length > 15 ? `(+${names.length - 15})` : "");
  console.log("axis color:", colors.slice(0, 10));
  console.log("axis size:", sizes.slice(0, 10));
  const prices = [...new Set(variants.map((v: any) => v.price))];
  console.log("harga varian:", prices);
} catch (e) {
  console.error("gagal parse:", e);
  console.log(raw.slice(0, 500));
}
