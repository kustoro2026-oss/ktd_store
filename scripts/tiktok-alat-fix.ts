/**
 * Perbaiki file upload TikTok kategori Alat & Perangkat Keras yang GAGAL,
 * berdasarkan file hasil TikTok:
 *   Tiktoksellercenter_Alat & Perangkat Keras_20260910_Tang Keling_result.xlsx
 *
 * Alasan kegagalan dari TikTok:
 *  1. Baris kosong kategori "Perkakas/Tang Keling" (nama/deskripsi/gambar/
 *     harga kosong). Supplier anekadropship TIDAK punya produk Tang Keling
 *     (sudah dicek: cari "keling", "tang keling", "rivet" -> 0 hasil),
 *     jadi baris kosong ini DIBUANG.
 *  2. "Tautan gambar ini gagal diproses" -> gambar memakai proxy wsrv.nl.
 *     Perbaikan: lepas wrapper wsrv.nl, pakai URL langsung
 *     https://anekadropship.id/uploads/products/*.
 *  3. Stok "Jumlah di Gudang Jakarta" wajib utk kategori Perekat -> diisi 100.
 *
 * Output: tiktok-upload/t3-Alat & Perangkat Keras-FIX.xlsx
 * Jalankan: node scripts/tiktok-alat-fix.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSXNS from "xlsx";
const XLSX: any = (XLSXNS as any).default ?? XLSXNS;

const RESULT = path.resolve(
  "Tiktoksellercenter_Alat & Perangkat Keras_20260910_Tang Keling_result.xlsx"
);
const TPL = path.resolve("tiktok-upload/t3-Alat & Perangkat Keras.xlsx");
const OUT = path.resolve("tiktok-upload/t3-Alat & Perangkat Keras-FIX.xlsx");

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

// Baca baris gagal dari file hasil TikTok
const wbRes = XLSX.readFile(RESULT);
const tRes: any[][] = XLSX.utils.sheet_to_json(wbRes.Sheets["Template"], { header: 1, defval: "" });

const rows: any[][] = [];
let skipped = 0;

// File hasil: R0 header "Alasan Kegagalan", R1 wajib, R2 instruksi -> data mulai R3
// Kolom hasil = kolom template + 1 (kolom 0 = alasan kegagalan).
for (let r = 3; r < tRes.length; r++) {
  const src = tRes[r];
  const nama = String(src[3] ?? "").trim();
  if (!nama) {
    skipped++;
    console.log(`Baris hasil ${r + 1} KOSONG (${String(src[1]).trim()}) -> dibuang.`);
    continue;
  }

  const row: any[] = new Array(28).fill("");
  row[0] = String(src[1] ?? "").replace(/\s*\(\d+\)\s*$/, "").trim(); // Kategori (buang "(888200)")
  row[1] = String(src[2] ?? "").trim(); // Merek
  row[2] = nama.slice(0, 255); // Nama produk
  if (row[2].length < 25) row[2] = (nama + " - Alat & Perangkat Keras Berkualitas").slice(0, 255);
  row[3] = String(src[4] ?? "").trim().slice(0, 2000); // Deskripsi produk
  for (let i = 0; i < 9; i++) row[4 + i] = cleanImg(src[5 + i]); // Gambar 1..9
  row[13] = String(src[14] ?? "").trim(); // Nama varian utama
  row[14] = String(src[15] ?? "").trim(); // Nilai varian utama
  row[15] = cleanImg(src[16]); // Gambar varian utama
  row[16] = String(src[17] ?? "").trim(); // Nama varian sekunder
  row[17] = String(src[18] ?? "").trim(); // Nilai varian sekunder
  row[18] = Number(src[19] ?? 0) || ""; // Berat paket(g)
  row[19] = Number(src[20] ?? 0) || ""; // Panjang
  row[20] = Number(src[21] ?? 0) || ""; // Lebar
  row[21] = Number(src[22] ?? 0) || ""; // Tinggi
  row[22] = ""; // Opsi Pengiriman
  row[23] = Number(src[24] ?? 0) || ""; // Harga Ritel
  row[24] = String(src[25] ?? "").trim(); // Pre-sale
  let jkt = Number(src[26] ?? 0) || 0; // Gudang Jakarta
  const jmb = Number(src[27] ?? 0) || 0; // Gudang Jombang
  if (jkt <= 0 && jmb <= 0) jkt = 100; // stok wajib diisi utk kategori ini
  row[25] = jkt > 0 ? jkt : "";
  row[26] = jmb > 0 ? jmb : "";
  row[27] = ""; // Gudang Pekalongan
  rows.push(row);
  console.log(`Baris hasil ${r + 1}: ${row[2].slice(0, 50)} -> DIPERBAIKI (${row[0]})`);
}

if (!rows.length) {
  console.error("Tidak ada baris yang bisa diperbaiki.");
  process.exit(1);
}

// Tulis ke salinan template t3. Bersihkan dulu baris data lama (0-based >= 5)
// dari sheet Template — file t3 di disk masih berisi baris lama hasil isian
// sebelumnya (Jaysuing, Bor Cordless, dll) yang sudah pernah diupload,
// jadi output hanya berisi baris gagal yang sudah diperbaiki.
// Baris instruksi template (0-based 4) WAJIB dipertahankan; TikTok menolak
// file yang struktur barisnya berubah ("Pastikan untuk melengkapi semua
// info wajib").
const wb = XLSX.readFile(TPL);
const ws = wb.Sheets["Template"];
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
console.log("Baris total Template:", t.length, "| baris kosong dibuang:", skipped);
for (let r = 4; r < t.length; r++) {
  const row = t[r];
  const img = String(row[4] || "");
  console.log(
    `[${r + 1}] ${String(row[0]).slice(0, 35).padEnd(35)} | ${String(row[2]).slice(0, 40).padEnd(40)} | berat=${row[18]} | harga=${row[23]} | stokJKT=${row[25]} | img=${img.includes("wsrv.nl") ? "WSRV-BURUK" : img.slice(-40)}`
  );
}
console.log("Output:", OUT);
