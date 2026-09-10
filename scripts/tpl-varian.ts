/**
 * Debug: lihat isi sheet Example/Instruction t2 untuk konvensi kolom varian.
 * Jalankan: node scripts/tpl-varian.ts
 */
import * as XLSXNS from "xlsx";
const XLSX: any = (XLSXNS as any).default ?? XLSXNS;

const wb = XLSX.readFile("tiktok-upload/t2-Pakaian Anak.xlsx");
for (const sn of ["Template", "Example", "Instruction"]) {
  if (!wb.Sheets[sn]) continue;
  const t = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" });
  console.log(`\n===== ${sn} (${t.length} baris) =====`);
  t.slice(0, 12).forEach((row: any[], i: number) => {
    // fokus kolom 1-28 (A-AB)
    const cells = row.slice(0, 28).map((c: any, j: number) => {
      const s = String(c).replace(/\s+/g, " ").trim();
      return s ? `${j}:${s.slice(0, 40)}` : "";
    });
    console.log(`[${i + 1}]`, cells.filter(Boolean).join(" | "));
  });
}
