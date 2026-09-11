// tiktok-dbg-header.ts — debug: apa yang xlsx lib lihat di baris 1..7 t12
import * as path from "node:path";
import * as XLSX from "xlsx";
const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");
const wb = XLSX.readFile(path.join(OUT, "t12-Olahraga & Outdoor.xlsx"));
const ws = wb.Sheets[wb.SheetNames[0]];
console.log("!ref =", ws["!ref"]);
for (let r = 1; r <= 7; r++) {
  const cells: string[] = [];
  for (let i = 0; i < 70; i++) {
    const col = XLSX.utils.encode_col(i);
    const c = ws[`${col}${r}`];
    if (c) cells.push(`${col}=${String(c.w ?? c.v ?? "").slice(0, 22).replace(/\s+/g, " ")}`);
  }
  console.log(`row ${r}:`, cells.join(" | "));
}
// apa isi sel gudang baris data?
for (const col of ["Z", "AA", "AQ", "AR", "AS"]) {
  console.log(`${col}3 =`, JSON.stringify(ws[`${col}3`]), `| ${col}8 =`, JSON.stringify(ws[`${col}8`]));
}
