/**
 * Bangun ulang file upload TikTok Shop kategori Kesehatan yang valid.
 *
 * Masalah file lama:
 *  1. Tautan gambar memakai proxy wsrv.nl (mis. https://wsrv.nl/?url=...&output=jpg)
 *     -> ditolak TikTok: "Tautan gambar ini gagal diproses".
 *     Perbaikan: pakai tautan langsung https://anekadropship.id/uploads/products/*.webp
 *  2. Sebagian baris belum terisi lengkap (nama/deskripsi/harga/gambar kosong).
 *     Perbaikan: semua kolom wajib diisi dari products.json.
 *  3. Kategori harus path valid dari dropdown (sheet Category template).
 *
 * Output: tiktok-upload/t1-Kesehatan-FIX.xlsx
 * Jalankan: node scripts/tiktok-kesehatan-fix.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSXNS from "xlsx";
import { toVariantRows, sanitizeAxis } from "./tiktok-variant-util.ts";
const XLSX: any = (XLSXNS as any).default ?? XLSXNS;

const TPL = path.resolve("Tiktoksellercenter_batchupload_20260910_template.xlsx");
const OUT = path.resolve("tiktok-upload/t1-Kesehatan-FIX.xlsx");
const PRODUCTS_FILE = path.resolve("tiktok-export/products.json");

// 16 produk Kesehatan (Grainvit 1565 & Olimex 1805 DIKELUARKAN:
// kategori Suplemen Makanan wajib atribut Nomor Ijin Edar BPOM/PIRT yang
// tidak bisa diisi lewat file bulk -> harus ditambah manual di Seller Center)
const IDS = [1156, 1131, 1133, 1261, 1454, 1150, 1157, 1572, 1152, 1151, 1283, 1154, 1132, 1148, 1158, 1453];

// Kategori valid dari sheet Category template (path persis sesuai dropdown)
const HERBAL = "Obat & Pengobatan Alternatif/Obat Herbal";
const VITAMIN = "Suplemen Makanan/Vitamin, Mineral & Suplemen Kesehatan";
const KEBUGARAN = "Suplemen Makanan/Suplemen Kebugaran";
const AKUPUNKTUR = "Obat & Pengobatan Alternatif/Akupunktur";

const CATEGORY: Record<number, string> = {
  1156: HERBAL, // Madu Sarcing Plus
  1565: KEBUGARAN, // Grainvit
  1805: VITAMIN, // Kapsul Minyak Ikan Gabus Olimex
  1131: AKUPUNKTUR, // Sisir Pijat Meridian (guasha)
  1133: AKUPUNKTUR, // Roller Pijat Batu Giok
  1261: HERBAL, // Kapsul Penambah Nafsu Makan
  1454: HERBAL, // Gang Jie + Ghosiah
  1150: HERBAL, // Madu Randu
  1157: HERBAL, // Madu Hutan Bawang Hitam
  1572: HERBAL, // Teh Herbal Kumis Kucing
  1152: HERBAL, // Madu Klanceng Putih
  1151: HERBAL, // Madu Klanceng Hitam
  1283: VITAMIN, // Omar Smart Brain
  1154: HERBAL, // Madu Lemon
  1132: AKUPUNKTUR, // Alat Pijat Terapi Manual
  1148: HERBAL, // Propolis Imunfit
  1158: HERBAL, // Madu Bawang Lanang
  1453: HERBAL, // Gang Jie De Nature
};

// Lepas wrapper wsrv.nl -> URL langsung
function cleanImg(u: string): string {
  if (!u) return "";
  const m = u.match(/[?&]url=(https?%3A%2F%2F[^&]+)/i);
  if (m) return decodeURIComponent(m[1]);
  return u.trim();
}

const all: any[] = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
const byId = new Map(all.map((p: any) => [Number(p.id), p]));

const wb = XLSX.readFile(TPL);
const ws = wb.Sheets["Template"];
const rows: any[][] = [];

// SheetJS membuang sel di luar range resmi sheet (!ref) saat write.
// Template TikTok punya baris tersembunyi 1-2 (kode field internal + versi
// template V5.0.2) di luar ref A3:AB6 -> wajib re-derive ref dari sel aktual
// agar baris itu ikut tersimpan (TikTok menolak file tanpa baris ini).
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

for (const id of IDS) {
  const p = byId.get(id);
  if (!p) {
    console.error("Produk tidak ditemukan:", id);
    continue;
  }
  let name = String(p.name || "").trim().slice(0, 255);
  if (name.length < 25) name = (name + " - Produk Kesehatan Herbal Alami").slice(0, 255); // syarat 25-255
  const desc = String(p.description || "").trim().slice(0, 2000);
  const imgs = (p.images || []).map(cleanImg).filter(Boolean).slice(0, 9);
  const weightG = p.weightKg != null && p.weightKg > 0 ? Math.max(1, Math.round(p.weightKg * 1000)) : 500;
  const len = p.lengthCm != null && p.lengthCm > 0 ? p.lengthCm : 10;
  const wid = p.widthCm != null && p.widthCm > 0 ? p.widthCm : 10;
  const hei = p.heightCm != null && p.heightCm > 0 ? p.heightCm : 10;
  const price = p.price != null && p.price > 0 ? Number(p.price) : "";
  const stock = p.stock != null && p.stock > 0 ? Math.floor(Number(p.stock)) : 100;

  // Varian aktif (stok > 0) -> satu baris TikTok per varian.
  // Varian tunggal tanpa warna/ukuran (pseudo-varian supplier, label = nama
  // produk) dianggap tanpa varian -> produk tampil sebagai satu SKU.
  const variants = toVariantRows(p.variants || []);
  const useVariants =
    variants.length > 1 ||
    (variants.length === 1 &&
      (variants[0].axis1Name === "Warna" || variants[0].axis1Name === "Ukuran"))
      ? variants
      : [];
  const vPrices = useVariants.map((v) => v.price).filter((x): x is number => x != null && x > 0);
  const minVPrice = vPrices.length ? Math.min(...vPrices) : 0;
  // Harga per varian benar-benar berbeda (bukan semua sama) -> hasil scaling
  // dibulatkan ke 500-an agar tidak ada harga ganjil (mis. 326383).
  const varies = vPrices.length > 1 && minVPrice !== Math.max(...vPrices);

  const pushRow = (v?: (typeof useVariants)[number]) => {
    // 28 kolom: 0 Kategori ... 27 Jumlah di Gudang Pekalongan
    const row: any[] = new Array(28).fill("");
    row[0] = CATEGORY[id]; // Kategori
    row[1] = ""; // Merek (Tanpa Merek)
    row[2] = name; // Nama produk (sama untuk semua varian)
    row[3] = desc; // Deskripsi produk
    for (let i = 0; i < 9; i++) row[4 + i] = imgs[i] ?? ""; // Gambar utama + Gambar 2..9
    if (v) {
      row[13] = sanitizeAxis(v.axis1Name, 20); // Nama varian utama
      row[14] = sanitizeAxis(v.axis1Value); // Nilai varian utama
      row[15] = ""; // Gambar varian (opsional)
      row[16] = sanitizeAxis(v.axis2Name, 20); // Nama varian sekunder
      row[17] = sanitizeAxis(v.axis2Value); // Nilai varian sekunder
    } else {
      row[13] = ""; row[14] = ""; row[15] = ""; row[16] = ""; row[17] = ""; // tanpa varian
    }
    row[18] = weightG; // Berat paket(g)
    row[19] = len; row[20] = wid; row[21] = hei; // dimensi cm
    row[22] = ""; // Opsi Pengiriman (opsional)
    // Harga: varian diskalakan ke markup produk (rekomendasi jual), fallback harga produk.
    let rowPrice = price;
    if (v && v.price != null && v.price > 0) {
      const scaled = minVPrice > 0 && price != null && price !== "" && Number(price) > 0
        ? (v.price * Number(price)) / minVPrice
        : v.price;
      rowPrice = varies ? Math.max(1000, Math.round(scaled / 500) * 500) : Math.round(scaled);
    }
    row[23] = rowPrice != null ? rowPrice : ""; // Harga Ritel
    row[24] = ""; // Pre-sale
    row[25] = v && v.stock != null && v.stock > 0 ? Math.floor(v.stock) : stock; // Gudang Jakarta
    row[26] = ""; // Jombang
    row[27] = ""; // Pekalongan
    rows.push(row);
  };

  if (useVariants.length) {
    // Dedupe kombinasi varian yang kembar.
    const seen = new Set<string>();
    for (const v of useVariants) {
      const key = `${v.axis1Name}|${v.axis1Value}|${v.axis2Name}|${v.axis2Value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pushRow(v);
    }
  } else {
    pushRow();
  }
}

// Tulis mulai sheet baris 6 (0-based 5) -> baris instruksi template (0-based 4)
// WAJIB dipertahankan; TikTok menolak file yang struktur barisnya berubah
// (muncul pesan "Pastikan untuk melengkapi semua info wajib").
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
for (let r = 4; r < t.length; r++) {
  const row = t[r];
  const img = String(row[4] || "");
  console.log(
    `[${r + 1}] ${String(row[0]).slice(0, 30).padEnd(30)} | ${String(row[2]).slice(0, 32).padEnd(32)} | ${String(row[13]).padEnd(7)} ${String(row[14]).padEnd(14)} | ${String(row[16]).padEnd(7)} ${String(row[17]).padEnd(10)} | harga=${row[23]} | stokJKT=${row[25]} | img=${img.includes("wsrv.nl") ? "WSRV-BURUK" : img.slice(0, 45)}`
  );
}
console.log("Output:", OUT);
