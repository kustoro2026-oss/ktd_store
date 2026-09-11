/**
 * tiktok-inspect.ts — Cek format nilai kolom Kategori di template resmi.
 * 1. Example sheet (t1): 3 baris pertama kolom Kategori + Merek
 * 2. Instruction sheet (t1): teks yang menyebut "Kategori"
 * 3. Template sheet (t1): baris 2-3 kolom Kategori (contoh baris kosong/validasi)
 * Jalankan: node scripts/tiktok-inspect.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";

const file = path.resolve("tiktok-template/raw/t1.zip");
const wb = XLSX.readFile(file);

console.log("=== SHEETS ===", wb.SheetNames.join(", "));

// Example sheet
const ex = XLSX.utils.sheet_to_json(wb.Sheets["Example"], { header: 1, defval: "" }) as any[][];
const exHdr = ex[0].map((c: any) => String(c));
const catIdx = exHdr.findIndex((c: string) => /kategori/i.test(c));
const brandIdx = exHdr.findIndex((c: string) => /merek|brand/i.test(c));
console.log("\n=== EXAMPLE header (idx kategori=", catIdx, ", merek=", brandIdx, ") ===");
console.log(exHdr.slice(0, 12).join(" | "));
console.log("--- contoh baris ---");
for (const row of ex.slice(1, 6)) {
  console.log("Kategori:", JSON.stringify(row[catIdx]), "| Merek:", JSON.stringify(row[brandIdx]));
}

// Instruction sheet: cari teks kategori
const ins = XLSX.utils.sheet_to_json(wb.Sheets["Instruction"], { header: 1, defval: "" }) as any[][];
console.log("\n=== INSTRUCTION: baris menyebut 'Kategori' ===");
for (const row of ins) {
  const line = row.map((c: any) => String(c)).join(" ");
  if (/kategori/i.test(line)) console.log(line.slice(0, 400));
}

// TemplateConfig: cari kunci 'category'
const cfg = XLSX.utils.sheet_to_json(wb.Sheets["TemplateConfig"], { header: 1, defval: "" }) as any[][];
console.log("\n=== TEMPLATECONFIG: kunci berisi 'categor' ===");
const cfgHdr = cfg[0].map((c: any) => String(c));
cfgHdr.forEach((c: string, i: number) => {
  if (/categor/i.test(c)) console.log(i, JSON.stringify(c), "-> contoh nilai:", JSON.stringify(cfg[1]?.[i]));
});

// Template sheet: 3 baris contoh (header + isian validasi)
const tpl = XLSX.utils.sheet_to_json(wb.Sheets["Template"], { header: 1, defval: "" }) as any[][];
console.log("\n=== TEMPLATE: contoh baris 2-4 (kolom 1-4) ===");
for (const row of tpl.slice(1, 4)) {
  console.log(JSON.stringify(row.slice(0, 4)));
}
