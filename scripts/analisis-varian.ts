/**
 * Analisis pola varian semua produk di products.json.
 * Jalankan: node scripts/analisis-varian.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { toVariantRows, splitLabel } from "./tiktok-variant-util.ts";

const a: any[] = JSON.parse(fs.readFileSync(path.resolve("tiktok-export/products.json"), "utf8"));

const withV = a.filter((x) => x.variants && x.variants.length);
const noV = a.filter((x) => !x.variants || !x.variants.length);
console.log("total:", a.length, "| dengan varian:", withV.length, "| tanpa varian:", noV.length);

// Total varian & statistik
const totalVar = withV.reduce((s, p) => s + p.variants.length, 0);
console.log("total varian:", totalVar);

// Pola: berapa yang pakai color/size terpisah, berapa yang pakai name gabungan
let colorFilled = 0, sizeFilled = 0, nameOnly = 0;
for (const p of withV) {
  const hasColor = p.variants.some((v: any) => v.color);
  const hasSize = p.variants.some((v: any) => v.size);
  if (hasColor) colorFilled++;
  if (hasSize) sizeFilled++;
  if (!hasColor && !hasSize) nameOnly++;
}
console.log("produk dgn field color terisi:", colorFilled, "| size terisi:", sizeFilled, "| hanya name:", nameOnly);

// Uji split pada produk dengan varian: berapa varian yang gagal diklasifikasi
// (satu kata non-ukuran = dianggap warna; yang jadi masalah adalah label aneh).
const failLabels = new Map<string, number>();
for (const p of withV) {
  for (const v of p.variants) {
    if (v.color || v.size) continue;
    const s = splitLabel(v.name);
    if (!s.warna && !s.ukuran) {
      failLabels.set(String(v.name), (failLabels.get(String(v.name)) ?? 0) + 1);
    }
  }
}
if (failLabels.size) {
  console.log("\nLabel gagal split:");
  for (const [k, n] of [...failLabels.entries()].sort((x, y) => y[1] - x[1]).slice(0, 30)) {
    console.log(" ", JSON.stringify(k), "x", n);
  }
} else {
  console.log("semua label bisa di-split");
}

// Contoh label unik dari produk dengan varian (untuk melihat ragam pola)
console.log("\nContoh label varian unik (30 pertama):");
const lbls = new Set<string>();
for (const p of withV) for (const v of p.variants) if (!v.color && !v.size) lbls.add(String(v.name));
[...lbls].slice(0, 30).forEach((l) => console.log(" ", JSON.stringify(l)));

// Produk dengan varian terbanyak
console.log("\nTop 10 produk varian terbanyak:");
withV
  .slice()
  .sort((x, y) => y.variants.length - x.variants.length)
  .slice(0, 10)
  .forEach((p) => console.log(` ${p.id} | ${p.variants.length} varian | ${String(p.name).slice(0, 45)}`));

// Hitung baris TikTok untuk 27 produk Pakaian Anak (IDS yang dipakai fill)
const IDS = [1543, 1542, 1539, 1536, 1482, 174, 175, 628, 629, 651, 652, 653, 654, 655, 656, 657, 658, 659, 660, 661, 662, 663, 664, 665, 666, 667, 668];
let totalRows = 0;
console.log("\nBaris TikTok untuk 27 produk Pakaian Anak:");
for (const id of IDS) {
  const p = a.find((x) => String(x.id) === String(id));
  if (!p) { console.log(` ${id} TIDAK ADA`); continue; }
  const rows = toVariantRows(p.variants || []);
  totalRows += rows.length || 1;
  console.log(` ${id} | varian=${rows.length} | ${String(p.name).slice(0, 40)}`);
}
console.log("TOTAL baris:", totalRows);
