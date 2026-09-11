/**
 * tiktok-makanan-hapus.ts — Hapus 2 baris Cuka Nanas (gagal upload) dari t7.
 *
 * Baris 13 (Cuka Nanas 250ml) dan 14 (Cuka Nanas 500ml) dihapus permanen
 * dari t7-Makanan & Minuman.xlsx. Baris lain digeser ke atas agar rapi.
 * Jalankan: node scripts/tiktok-makanan-hapus.ts
 */
import * as path from "node:path";
import * as XLSXNS from "xlsx";
const XLSX: any = (XLSXNS as any).default ?? XLSXNS;

const TPL = path.resolve("tiktok-upload/t7-Makanan & Minuman.xlsx");

function fixRef(sheet: any) {
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const k of Object.keys(sheet)) {
    if (k[0] === "!") continue;
    const c = XLSX.utils.decode_cell(k);
    minR = Math.min(minR, c.r); maxR = Math.max(maxR, c.r);
    minC = Math.min(minC, c.c); maxC = Math.max(maxC, c.c);
  }
  if (minR !== Infinity) {
    sheet["!ref"] = XLSX.utils.encode_range({ s: { r: minR, c: minC }, e: { r: maxR, c: maxC } });
  }
}

const wb = XLSX.readFile(TPL);
const ws = wb.Sheets["Template"];
const get = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v;

for (const r of [13, 14]) {
  console.log("[HAPUS]", String(get(r, 2) ?? ""), "| SKU:", String(get(r, 43) ?? ""));
}

// Kumpulkan semua sel data (baris >= 5), lalu tulis ulang tanpa baris 13 & 14
const keep: { r: number; c: number; v: unknown }[] = [];
for (const k of Object.keys(ws)) {
  if (k[0] === "!") continue;
  const c = XLSX.utils.decode_cell(k);
  if (c.r >= 5) keep.push({ r: c.r, c: c.c, v: ws[k].v });
}
for (const k of Object.keys(ws)) {
  if (k[0] === "!") continue;
  const c = XLSX.utils.decode_cell(k);
  if (c.r >= 5) delete ws[k];
}
const skip = new Set([13, 14]);
const srcRows = [...new Set(keep.map((x) => x.r))].sort((a, b) => a - b);
const remap = new Map<number, number>();
let outR = 5;
for (const r of srcRows) {
  if (skip.has(r)) continue;
  remap.set(r, outR);
  outR++;
}
for (const cell of keep) {
  if (skip.has(cell.r)) continue;
  ws[XLSX.utils.encode_cell({ r: remap.get(cell.r)!, c: cell.c })] = { v: cell.v };
}
for (const sn of wb.SheetNames) fixRef(wb.Sheets[sn]);
XLSX.writeFile(wb, TPL);

// Verifikasi
const wb2 = XLSX.readFile(TPL);
const ws2 = wb2.Sheets["Template"];
const get2 = (r: number, c: number) => ws2[XLSX.utils.encode_cell({ r, c })]?.v;
console.log("Signature A1:", JSON.stringify(get2(0, 0)), "| A2:", JSON.stringify(get2(1, 0)));
let maxR = -Infinity;
for (const k of Object.keys(ws2)) {
  if (k[0] === "!") continue;
  maxR = Math.max(maxR, XLSX.utils.decode_cell(k).r);
}
console.log("Baris max:", maxR, "(7 produk tersisa)");
for (let r = 7; r <= maxR; r++) {
  const n = get2(r, 2);
  if (n !== undefined) console.log(" r", r, ":", String(n).slice(0, 60));
}
