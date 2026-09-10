/**
 * tiktok-tplstruct.ts — Dump struktur sheet Template resmi t1:
 *  - semua kolom: header, Wajib/Opsional, potongan instruksi
 *  - baris 0..6 untuk melihat posisi baris contoh vs baris data
 *  - sheet TemplateConfig baris 1..3 (contoh nilai konfigurasi)
 * Jalankan: node scripts/tiktok-tplstruct.ts
 */
import * as path from "node:path";
import * as XLSXNS from "xlsx";
const XLSX: typeof XLSXNS = (XLSXNS as any).default ?? XLSXNS;

const file = path.resolve("tiktok-template/raw/t1.zip");
const wb = XLSX.readFile(file);
const tpl = XLSX.utils.sheet_to_json(wb.Sheets["Template"], { header: 1, defval: "" }) as any[][];

console.log("jumlah baris sheet Template:", tpl.length, "| kolom:", tpl[0].length);
console.log("\n=== baris 0..6, kolom 0..3 ===");
for (let r = 0; r <= 6; r++) {
  const row = tpl[r] ?? [];
  console.log(`r${r}:`, JSON.stringify(row.slice(0, 4)));
}

console.log("\n=== header + Wajib/Opsional (semua kolom) ===");
const hdr = tpl[0].map((c: any) => String(c));
const req = tpl[1].map((c: any) => String(c));
hdr.forEach((h, i) => console.log(`${i}\t${req[i] ?? "-"}\t${h.slice(0, 80)}`));

console.log("\n=== TemplateConfig: 2 baris contoh ===");
const cfg = XLSX.utils.sheet_to_json(wb.Sheets["TemplateConfig"], { header: 1, defval: "" }) as any[][];
const cfgHdr = cfg[0].map((c: any) => String(c));
for (const row of cfg.slice(1, 3)) {
  console.log("---");
  row.forEach((v: any, i: number) => {
    if (String(v) !== "") console.log(`${cfgHdr[i]}: ${JSON.stringify(v)}`.slice(0, 160));
  });
}
