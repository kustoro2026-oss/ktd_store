// tiktok-verify-fill.ts — verifikasi menyeluruh 12 file xlsx hasil fill2:
// 1. Semua sel gudang (Z..AQ) terisi benar sesuai lokasi produk
// 2. Tidak ada sel keliru (stok di kolom gudang yang salah)
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");
const TOP100 = JSON.parse(fs.readFileSync(path.join(ROOT, "tiktok-export", "top100.json"), "utf8")) as any[];

// lokasi -> gudang (sama seperti fill2)
const GUDANG = new Map<string, string>();
for (const line of fs
  .readFileSync(path.join(ROOT, "tiktok-export", "warehouse-consolidation.csv"), "utf8")
  .split(/\r?\n/)) {
  const t = line.trim();
  if (!t) continue;
  const p = t.split(";");
  if (p.length >= 2) GUDANG.set(p[0].trim().toLowerCase(), p[1].trim());
}
const gudangOf = (loc: string) => {
  const k = (loc ?? "").trim().toLowerCase();
  return k ? (GUDANG.get(k) ?? `Gudang ${loc.trim()}`) : "Gudang Jakarta";
};

const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".xlsx"));
const WH_COLS = ["Z","AA","AB","AC","AD","AE","AF","AG","AH","AI","AJ","AK","AL","AM","AN","AO","AP","AQ"];

let totalRows = 0;
let problems = 0;
for (const f of files.sort()) {
  const wb = XLSX.readFile(path.join(OUT, f));
  const ws = wb.Sheets[wb.SheetNames[0]];
  // header baris 3: nama kolom gudang
  const whName = new Map<string, string>(); // colLetter -> gudang
  const norm = (s: string) => s.replace(/\u00a0/g, " ").trim();
  for (const col of WH_COLS) {
    const h = ws[`${col}3`];
    const v = norm(h ? String(h.w ?? h.v ?? "") : "");
    if (v.startsWith("Jumlah di ")) whName.set(col, v.slice("Jumlah di ".length).trim());
  }
  if (whName.size === 0) { console.log(`${f}: TIDAK ADA kolom gudang?!`); problems++; continue; }
  // baca semua baris data 8..2000
  let rows = 0;
  const seenSkus = new Set<string>();
  for (let r = 8; r <= 2000; r++) {
    const nameCell = ws[`C${r}`];
    if (!nameCell) break;
    rows++;
    const name = String(nameCell.w ?? nameCell.v ?? "");
    const sku = String(ws[`AR${r}`]?.w ?? ws[`AR${r}`]?.v ?? "");
    if (seenSkus.has(sku)) { console.log(`  !! duplikat SKU ${sku} baris ${r}`); problems++; }
    seenSkus.add(sku);
    // temukan produk di top100
    const p = TOP100.find((x) => String(x.sku ?? x.id) === sku);
    if (!p) { console.log(`  !! SKU ${sku} tidak ada di top100`); problems++; continue; }
    const expectGudang = norm(gudangOf(p.location));
    // cek semua kolom gudang: hanya 1 yang terisi, dan harus kolom yang benar
    const filled: string[] = [];
    for (const [col, gRaw] of whName) {
      const g = norm(gRaw);
      const c = ws[`${col}${r}`];
      const v = c ? Number(c.v) : NaN;
      if (!isNaN(v) && v > 0) filled.push(`${col}=${v}(${g})`);
    }
    if (filled.length === 0) {
      console.log(`  !! ${f} baris ${r} (${name.slice(0,30)}): TIDAK ADA stok`);
      problems++;
    } else if (filled.length > 1) {
      console.log(`  !! ${f} baris ${r} (${name.slice(0,30)}): stok >1 kolom: ${filled.join(", ")}`);
      problems++;
    } else {
      const m = filled[0].match(/^([A-Z]+)=(\d+)\((.*)\)$/);
      if (m && m[3] !== expectGudang) {
        console.log(`  !! ${f} baris ${r} (${name.slice(0,30)}): stok di "${m[3]}" padahal harusnya "${expectGudang}"`);
        problems++;
      }
    }
  }
  totalRows += rows;
  console.log(`${f}: ${rows} produk, ${whName.size} kolom gudang, ${seenSkus.size} SKU unik`);
}
console.log(`\nTOTAL: ${totalRows} baris produk, ${problems} masalah`);
