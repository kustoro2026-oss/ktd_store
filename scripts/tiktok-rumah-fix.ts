/**
 * Bangun file upload TikTok kategori Perlengkapan Rumah Tangga LENGKAP
 * (semua produk yang belum diupload = 23 produk).
 *
 * Sumber data:
 *  - t8-Perlengkapan Rumah Tangga.xlsx (baris data lama yang disiapkan user)
 *  - tiktok-export/products.json (stok supplier)
 *
 * Perbaikan yang dilakukan:
 *  1. URL gambar proxy wsrv.nl -> URL langsung anekadropship.id
 *     (TikTok menolak: "Tautan gambar ini gagal diproses").
 *  2. Stok Gudang Jakarta (kolom 25) WAJIB utk kategori ini -> diisi dari
 *     stok supplier (products.json), fallback 100.
 *  3. Atribut tersembunyi "Contains dangerous goods?" (kolom 58 = index 57,
 *     product_property/101734) WAJIB untuk kategori Pembersih Rumah Tangga
 *     (Semprotan/Cairan Disinfektan, Pembuka Saluran, Pembersih Toilet) ->
 *     diisi "Tidak". Untuk kategori "Anti Ngengat, Jamur & Lembab" kolom ini
 *     dilarang diisi (HiddenStyle=Forbid).
 *     (Error TikTok: "atribut produk is missing ... ID:101734".)
 *  4. Nama produk < 25 char ditambah suffix.
 *
 * Output: tiktok-upload/t8-Perlengkapan Rumah Tangga-FIX.xlsx
 * Jalankan: node scripts/tiktok-rumah-fix.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSXNS from "xlsx";
const XLSX: any = (XLSXNS as any).default ?? XLSXNS;

const TPL = path.resolve("tiktok-upload/t8-Perlengkapan Rumah Tangga.xlsx");
const OUT = path.resolve("tiktok-upload/t8-Perlengkapan Rumah Tangga-FIX.xlsx");
const PRODUCTS_FILE = path.resolve("tiktok-export/products.json");

// Kategori yang WAJIB atribut "Contains dangerous goods?" (ID 101734)
const DG_REQUIRED = [
  "Semprotan, Cairan, dan Tisu Disinfektan",
  "Pembuka Saluran",
  "Pembersih Toilet",
  "Pembersih Kerak",
  "Pembersih Kamar Mandi",
  "Penghilang Jamur",
];

// Lepas wrapper wsrv.nl -> URL langsung
function cleanImg(u: unknown): string {
  const s = String(u ?? "").trim();
  if (!s) return "";
  const m = s.match(/[?&]url=(https?%3A%2F%2F[^&]+)/i);
  if (m) return decodeURIComponent(m[1]);
  return s;
}

// SheetJS membuang sel di luar range resmi (!ref) saat write -> wajib
// re-derive ref dari sel aktual agar baris signature tersembunyi (A1/A2)
// ikut tersimpan (TikTok menolak file tanpa baris ini).
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

// ---- Cocokkan nama baris template ke produk supplier (untuk stok) ----
const SUPPLIER: any[] = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
const STOP = new Set([
  "the", "a", "an", "dan", "untuk", "di", "yang", "ampuh", "wangi", "murah",
  "berkualitas", "original", "pcs", "pembersih", "obat", "100", "250", "500",
  "200", "10", "20", "30", "50", "2pcs", "1kg", "500ml", "120ml", "250ml",
  "1liter", "gram", "ml", "kg", "dengan", "plus", "untuk", "dari", "sudah",
]);
function norm(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(
    (w) => w.length > 1 && !STOP.has(w)
  );
}
function nums(s: string): string[] {
  return (s.toLowerCase().match(/\d+/g) || []).map((n) => String(Number(n)));
}
function findSupplier(nama: string): { name: string; stock: number } | null {
  const namaLow = nama.toLowerCase();
  // Nama pendek (mis. "Pembersih Meja") -> cocokkan sebagai substring penuh
  for (const p of SUPPLIER) {
    if (p.name.toLowerCase().includes(namaLow)) {
      return { name: p.name, stock: Number(p.stock) || 0 };
    }
  }
  const toks = norm(nama);
  const numsT = nums(nama);
  let best: { score: number; p: any } | null = null;
  for (const p of SUPPLIER) {
    const pt = norm(p.name);
    let score = 0;
    for (const t of toks) {
      if (pt.includes(t)) score += 1;
    }
    if (score === 0) continue;
    // Hukuman jika ada angka di nama yang tidak sama (mis. "10 ml" vs "20 ml")
    const numsP = nums(p.name);
    if (numsT.length && numsP.length && numsT[0] !== numsP[0]) score -= 5;
    if (!best || score > best.score) best = { score, p };
  }
  if (best && best.score >= 2) return { name: best.p.name, stock: Number(best.p.stock) || 0 };
  return null;
}

// ---- Baca baris data dari template t8 ----
const wb = XLSX.readFile(TPL);
const ws = wb.Sheets["Template"];
const get = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v;

const rows: any[][] = [];
let skipped = 0;

// Baris data template: 0-based 5..29 (baris 6 contoh "Dres wanita" dibuang)
for (let r = 5; r <= 30; r++) {
  const nama = String(get(r, 2) ?? "").trim();
  const kat = String(get(r, 0) ?? "").trim();
  if (!nama) { skipped++; console.log(`Baris ${r + 1} dilewati (kosong: ${kat.slice(0, 40)})`); continue; }
  if (nama.includes("Dress Malam")) { skipped++; console.log(`Baris ${r + 1} dilewati (contoh template: ${nama.slice(0, 40)})`); continue; }

  // 58 kolom penuh: 0-27 tampak + 28-42 gudang lain + 43-45 SKU/order/ukuran
  // + 46 cod + 47-57 product_property.
  const row: any[] = new Array(58).fill("");
  row[0] = kat.replace(/\s*\(\d+\)\s*$/, "").trim(); // Kategori (buang "(1244944)")
  row[1] = String(get(r, 1) ?? "").trim(); // Merek
  row[2] = nama.slice(0, 255); // Nama produk
  if (row[2].length < 25) row[2] = (nama + " - Perlengkapan Rumah Tangga Berkualitas").slice(0, 255);
  row[3] = String(get(r, 3) ?? "").trim().slice(0, 2000); // Deskripsi produk
  for (let i = 0; i < 9; i++) row[4 + i] = cleanImg(get(r, 4 + i)); // Gambar 1..9
  row[13] = String(get(r, 13) ?? "").trim(); // Nama varian utama
  row[14] = String(get(r, 14) ?? "").trim(); // Nilai varian utama
  row[15] = cleanImg(get(r, 15)); // Gambar varian utama
  row[16] = String(get(r, 16) ?? "").trim(); // Nama varian sekunder
  row[17] = String(get(r, 17) ?? "").trim(); // Nilai varian sekunder
  row[18] = Number(get(r, 18) ?? 0) || ""; // Berat paket(g)
  row[19] = Number(get(r, 19) ?? 0) || 10; // Panjang
  row[20] = Number(get(r, 20) ?? 0) || 10; // Lebar
  row[21] = Number(get(r, 21) ?? 0) || 10; // Tinggi
  row[22] = ""; // Opsi Pengiriman
  row[23] = Number(get(r, 23) ?? 0) || ""; // Harga Ritel
  row[24] = String(get(r, 24) ?? "").trim(); // Pre-sale
  let jkt = Number(get(r, 25) ?? 0) || 0; // Gudang Jakarta
  const jmb = Number(get(r, 26) ?? 0) || 0; // Gudang Jombang
  if (jkt <= 0 && jmb <= 0) {
    const sup = findSupplier(nama);
    jkt = sup && sup.stock > 0 ? sup.stock : 100;
    console.log(
      `  stok diisi dari supplier: ${jkt}${sup ? ` (${sup.name.slice(0, 40)})` : " (FALLBACK 100, tidak ketemu di products.json)"}`
    );
  }
  row[25] = jkt > 0 ? jkt : "";
  row[26] = jmb > 0 ? jmb : "";
  row[27] = ""; // Gudang Pekalongan

  // Atribut "Contains dangerous goods?" (ID 101734) -> wajib utk kategori
  // Pembersih Rumah Tangga tertentu; "Anti Ngengat" = Forbid (jangan diisi).
  if (DG_REQUIRED.some((k) => row[0].endsWith(k))) row[57] = "Tidak";

  rows.push(row);
  console.log(`Baris ${r + 1}: ${row[2].slice(0, 50)} -> DIPROSES (${row[0].slice(-40)})`);
}

if (!rows.length) {
  console.error("Tidak ada baris yang bisa diproses.");
  process.exit(1);
}

// Tulis ke salinan template t8. Bersihkan dulu baris data lama (0-based >= 5)
// Baris instruksi template (0-based 4) WAJIB dipertahankan; TikTok menolak
// file yang struktur barisnya berubah ("Pastikan untuk melengkapi semua
// info wajib").
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
console.log("\nSignature A1:", JSON.stringify(wb2.Sheets["Template"]["A1"]?.v), "| A2:", JSON.stringify(wb2.Sheets["Template"]["A2"]?.v));
console.log("Baris total Template:", t.length, "| baris dilewati:", skipped, "| produk ditulis:", rows.length);
let wsrvCount = 0;
for (let r = 5; r < t.length; r++) {
  const row = t[r];
  for (let i = 4; i <= 12; i++) if (String(row[i] ?? "").includes("wsrv.nl")) wsrvCount++;
  const img = String(row[4] || "");
  console.log(
    `[${r + 1}] ${String(row[0]).slice(-35).padStart(35)} | ${String(row[2]).slice(0, 38).padEnd(38)} | berat=${row[18]} | harga=${row[23]} | stokJKT=${row[25]} | DG=${row[57]} | img=${img.includes("wsrv.nl") ? "WSRV-BURUK" : img.slice(-30)}`
  );
}
console.log("\nSisa sel wsrv.nl:", wsrvCount);
console.log("Output:", OUT);
