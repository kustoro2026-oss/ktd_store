/**
 * tiktok-makanan-fix.ts — Perbaiki 2 baris gagal upload t7 (Makanan & Minuman).
 *
 * Hasil TikTok (result): hanya 2 baris gagal dari 9 produk t7:
 *  1. Cuka Nanas 250ml With Mother:
 *     - atribut produk missing ID:101084 "Jenis Sertifikasi" (kolom 58)
 *     - deskripsi mengandung kata terlarang "Shopee"
 *  2. Cuka Nanas 500ml With Mother:
 *     - tautan gambar wsrv.nl gagal diproses
 *
 * Perbaikan:
 *  - Kolom 58 (Jenis Sertifikasi) = "SPP-IRT" (nilai valid HiddenAttr untuk
 *    kategori Cuka; supplier mencantumkan "Sertifikasi PIRT, HALAL MUI").
 *  - Deskripsi: potong blok "KETENTUAN GARANSI PRODUK" (berisi "Shopee") +
 *    buang baris yang masih menyebut marketplace lain.
 *  - Gambar: lepas wrapper wsrv.nl -> URL langsung anekadropship.id.
 *
 * Output hanya berisi 2 baris yang gagal (7 produk lain sudah lolos upload).
 * Jalankan: node scripts/tiktok-makanan-fix.ts
 * Output:  tiktok-upload/t7-Makanan & Minuman-FIX.xlsx
 */
import * as path from "node:path";
import * as XLSXNS from "xlsx";
const XLSX: any = (XLSXNS as any).default ?? XLSXNS;

const TPL = path.resolve("tiktok-upload/t7-Makanan & Minuman.xlsx");
const OUT = path.resolve("tiktok-upload/t7-Makanan & Minuman-FIX.xlsx");

// Lepas wrapper wsrv.nl -> URL langsung
function cleanImg(u: unknown): string {
  const s = String(u ?? "").trim();
  if (!s) return "";
  const m = s.match(/[?&]url=(https?%3A%2F%2F[^&]+)/i);
  if (m) return decodeURIComponent(m[1]);
  return s;
}

// Bersihkan deskripsi: potong blok garansi seller, buang baris marketplace lain
function cleanDesc(d: unknown): string {
  const CR = String.fromCharCode(13);
  const NL = String.fromCharCode(10);
  let out = String(d ?? "");
  const gi = out.toLowerCase().indexOf("ketentuan garansi produk");
  if (gi >= 0) out = out.slice(0, gi);
  out = out
    .split(CR)
    .join("")
    .split(NL)
    .filter((l) => !/shopee|tokopedia|lazada|bukalapak|blibli/i.test(l))
    .join(NL);
  return out.trim().slice(0,2000);
}

// SheetJS membuang sel di luar range resmi (!ref) saat write -> wajib
// re-derive ref dari sel aktual agar baris signature tersembunyi ikut tersimpan.
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

console.log("Signature t7: A1 =", JSON.stringify(get(0, 0)), "| A2 =", JSON.stringify(get(1, 0)));

// Salin semua sel data dari baris asal, terapkan perbaikan
function rebuild(r: number): any[] {
  const row: any[] = new Array(63).fill("");
  row[0] = String(get(r, 0) ?? "").trim();
  row[1] = String(get(r, 1) ?? "").trim();
  row[2] = String(get(r, 2) ?? "").trim();
  row[3] = cleanDesc(get(r, 3));
  for (let i = 0; i < 9; i++) row[4 + i] = cleanImg(get(r, 4 + i));
  for (let c = 13; c <= 57; c++) {
    const v = get(r, c);
    if (v !== undefined && String(v).trim() !== "") row[c] = v;
  }
  row[58] = "SPP-IRT"; // Jenis Sertifikasi (101084)
  for (let c = 59; c <= 62; c++) {
    const v = get(r, c);
    if (v !== undefined && String(v).trim() !== "") row[c] = v;
  }
  return row;
}

const rows: any[][] = [rebuild(13), rebuild(14)];
for (const row of rows) {
  console.log("[FIX]", String(row[2]), "| sertifikasi =", String(row[58]), "| gambar2 =", String(row[5]).slice(0, 70));
}

// Bersihkan baris data lama (0-based >= 5), tulis 2 baris perbaikan
for (const k of Object.keys(ws)) {
  if (k[0] === "!") continue;
  const c = XLSX.utils.decode_cell(k);
  if (c.r >= 5) delete ws[k];
}
XLSX.utils.sheet_add_aoa(ws, rows, { origin: 5 });
for (const sn of wb.SheetNames) fixRef(wb.Sheets[sn]);
XLSX.writeFile(wb, OUT);

// Verifikasi baca ulang
const wb2 = XLSX.readFile(OUT);
const t = XLSX.utils.sheet_to_json(wb2.Sheets["Template"], { header: 1, defval: "" });
console.log("Signature A1:", JSON.stringify(wb2.Sheets["Template"]["A1"]?.v), "| A2:", JSON.stringify(wb2.Sheets["Template"]["A2"]?.v));
console.log("Baris total Template:", t.length);
let wsrv = 0;
for (let r = 5; r < t.length; r++) {
  for (let i = 4; i <= 12; i++) if (String(t[r][i] ?? "").includes("wsrv.nl")) wsrv++;
}
console.log("Sisa sel wsrv.nl:", wsrv);
console.log("Output:", OUT);
