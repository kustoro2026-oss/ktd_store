/**
 * Bangun ulang file upload TikTok Shop kategori Pakaian Anak yang valid.
 *
 * Masalah file lama:
 *  - Tautan gambar memakai proxy wsrv.nl (https://wsrv.nl/?url=...&output=jpg)
 *    -> ditolak TikTok: "Tautan gambar ini gagal diproses".
 *    Perbaikan: pakai tautan langsung https://anekadropship.id/uploads/products/*
 *  - Varian produk (warna/ukuran) tidak ikut ter-scrape -> produk kehilangan
 *    varian. Perbaikan: satu baris per varian dengan harga/stok/SKU masing-
 *    masing (kolom 13-17 + SKU unik di kolom 43).
 *
 * Output: tiktok-upload/TIKTOK-PAKAIAN-ANAK-FIX.xlsx
 * Jalankan: node scripts/tiktok-pakaian-fix.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSXNS from "xlsx";
import { toVariantRows, sanitizeAxis } from "./tiktok-variant-util.ts";
const XLSX: any = (XLSXNS as any).default ?? XLSXNS;

const TPL = path.resolve("tiktok-upload/t2-Pakaian Anak.xlsx");
const OUT = path.resolve("tiktok-upload/TIKTOK-PAKAIAN-ANAK-FIX.xlsx");
const PRODUCTS_FILE = path.resolve("tiktok-export/products.json");

// Produk yang masuk file ini (kategori tersedia di template t2 Pakaian Anak):
// - 4 jumpsuit/setelan anak + 1 dress anak -> kategori anak yang tepat
// - 22 kemeja batik dewasa -> pakai kategori "Setelan Resmi & Setelan"
//   (pilihan user sebelumnya, diterima TikTok; idealnya template Pakaian Pria)
// Dikeluarkan: sarung, cincin, kalung, buku stiker, shoes cleaner
// (tidak ada kategori yang cocok di template Pakaian Anak ini)
// Dihapus dari supplier (halaman 404): 654 Gurdo Navy, 665 Ramayana,
// 666 Prayoga, 667 Banuaji, 668 Ramawijaya -> tidak diikutsertakan lagi.
const IDS = [1543, 1542, 1539, 1536, 1482, 174, 175, 628, 629, 651, 652, 653, 655, 656, 657, 658, 659, 660, 661, 662, 663, 664];

// Kategori valid dari sheet Category t2 (path persis sesuai dropdown)
const SETELAN = "Pakaian Anak Perempuan/Setelan Resmi & Setelan"; // 804616
const JUMPSUIT = "Pakaian Anak Perempuan/Atasan/Jumpsuit Anak Perempuan"; // 1198864
const GAUN = "Pakaian Anak Perempuan/Gaun"; // 804744

const JUMP_IDS = [1543, 1542, 1539, 1536]; // oneset/jumpsuit anak
const CATEGORY: Record<number, string> = {
  1482: GAUN, // Happy Little Dress Orchid Anak Perempuan
  174: SETELAN, 175: SETELAN, // Kemeja Batik Biasa/Premium
  628: SETELAN, 629: SETELAN, // Kemeja Mega Mendung / Sembodo
  // 651-668: kemeja Batik Florist
};
for (const id of IDS) if (!CATEGORY[id]) CATEGORY[id] = JUMP_IDS.includes(id) ? JUMPSUIT : SETELAN;

// Kolom tersembunyi (AC-BB) yang wajib untuk kategori pakaian:
// 45=size_chart(Bagan Ukuran) 47=Pola 48=Musim 49=Gaya 50=Melar 51=Usia 52=Bahan
const BASE_URL = "https://toko.kustoro2026.com";
const SIZE_CHART_DEWASA = `${BASE_URL}/tabel-ukuran.png`;
const SIZE_CHART_ANAK = `${BASE_URL}/tabel-ukuran-anak.png`;
const ATTR_DEWASA = { pola: "Motif All-Over", musim: "Semua musim", gaya: "Dasar", melar: "Sedikit", usia: "13-14 Tahun", bahan: "Katun" };
const ATTR_ANAK = { pola: "Polos", musim: "Semua musim", gaya: "Simpel", melar: "Sedikit", usia: "5-6 Tahun", bahan: "Katun" };
const ATTR_GAUN = { pola: "Bunga", musim: "Semua musim", gaya: "Imut", melar: "Sedikit", usia: "5-6 Tahun", bahan: "Katun" };

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

// Hapus dulu semua baris data lama (baris sheet > 4) agar file bersih
for (const k of Object.keys(ws)) {
  if (k[0] === "!") continue;
  const c = XLSX.utils.decode_cell(k);
  if (c.r > 3) delete ws[k];
}

for (const id of IDS) {
  const p = byId.get(id);
  if (!p) {
    console.error("Produk tidak ditemukan:", id);
    continue;
  }
  let name = String(p.name || "").trim().slice(0, 255);
  if (name.length < 25) name = (name + " - Kemeja Premium Katun Batik").slice(0, 255); // syarat 25-255
  const desc = String(p.description || "").trim().slice(0, 2000);
  const imgs = (p.images || []).map(cleanImg).filter(Boolean).slice(0, 9);
  const weightG = p.weightKg != null && p.weightKg > 0 ? Math.max(1, Math.round(p.weightKg * 1000)) : 500;
  const len = p.lengthCm != null && p.lengthCm > 0 ? p.lengthCm : 10;
  const wid = p.widthCm != null && p.widthCm > 0 ? p.widthCm : 10;
  const hei = p.heightCm != null && p.heightCm > 0 ? p.heightCm : 10;
  const price = p.price != null && p.price > 0 ? Number(p.price) : null;
  const stock = p.stock != null && p.stock > 0 ? Math.floor(Number(p.stock)) : 100;
  const skuBase = (String(p.sku || "").trim() || `SKU-${id}`).slice(0, 40);

  // Atribut kategori (hidden columns) sama untuk semua baris produk ini.
  const a = CATEGORY[id] === GAUN ? ATTR_GAUN : JUMP_IDS.includes(id) ? ATTR_ANAK : ATTR_DEWASA;
  const sizeChart = JUMP_IDS.includes(id) || CATEGORY[id] === GAUN ? SIZE_CHART_ANAK : SIZE_CHART_DEWASA;

  // Varian aktif (stok > 0) -> satu baris TikTok per varian.
  // Varian tunggal tanpa warna/ukuran (pseudo-varian supplier) dianggap
  // tanpa varian -> produk tampil sebagai satu SKU.
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
  // dibulatkan ke 500-an agar tidak ada harga ganjil (mis. 200001).
  const varies = vPrices.length > 1 && minVPrice !== Math.max(...vPrices);

  const pushRow = (v?: (typeof useVariants)[number]) => {
    // 54 kolom: 0 Kategori ... 27 Gudang Pekalongan, 28-42 gudang lain,
    // 43 SKU, 44 pembelian minimum, 45 Bagan Ukuran, 46 COD,
    // 47 Pola, 48 Musim, 49 Gaya, 50 Melar, 51 Usia, 52 Bahan, 53 SNI
    const row: any[] = new Array(54).fill("");
    row[0] = CATEGORY[id]; // Kategori
    row[1] = ""; // Merek (Tanpa Merek)
    row[2] = name; // Nama produk (sama untuk semua varian)
    row[3] = desc; // Deskripsi produk
    for (let i = 0; i < 9; i++) row[4 + i] = imgs[i] ?? ""; // Gambar utama + Gambar 2..9
    if (v) {
      row[13] = sanitizeAxis(v.axis1Name, 20); // Nama varian utama (Warna/Ukuran)
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
      const scaled = minVPrice > 0 && price != null && price > 0
        ? (v.price * price) / minVPrice
        : v.price;
      rowPrice = varies ? Math.max(1000, Math.round(scaled / 500) * 500) : Math.round(scaled);
    }
    row[23] = rowPrice != null ? rowPrice : ""; // Harga Ritel
    row[24] = ""; // Pre-sale
    row[25] = v && v.stock != null && v.stock > 0 ? Math.floor(v.stock) : stock; // Gudang Jakarta
    row[26] = ""; // Jombang
    row[27] = ""; // Pekalongan
    // Kolom tersembunyi yang wajib untuk kategori pakaian
    row[43] = v ? `${skuBase}-${v.variantId}`.slice(0, 50) : skuBase; // SKU unik per varian
    row[45] = sizeChart; // Bagan Ukuran
    row[47] = a.pola;
    row[48] = a.musim;
    row[49] = a.gaya;
    row[50] = a.melar;
    row[51] = a.usia;
    row[52] = a.bahan;
    rows.push(row);
  };

  if (useVariants.length) {
    // Dedupe kombinasi (warna, ukuran) yang kembar.
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

// Tulis mulai sheet baris 5 (0-based 4) -> menimpa baris contoh template
XLSX.utils.sheet_add_aoa(ws, rows, { origin: 4 });
for (const sn of wb.SheetNames) fixRef(wb.Sheets[sn]);
XLSX.writeFile(wb, OUT);

// Verifikasi baca ulang
const wb2 = XLSX.readFile(OUT);
const t = XLSX.utils.sheet_to_json(wb2.Sheets["Template"], { header: 1, defval: "" });
console.log("Signature A1:", JSON.stringify(wb2.Sheets["Template"]["A1"]?.v), "| A2:", JSON.stringify(wb2.Sheets["Template"]["A2"]?.v));
console.log("Baris total Template:", t.length);
for (let r = 4; r < t.length; r++) {
  const row = t[r];
  console.log(
    `[${r + 1}] ${String(row[0]).slice(0, 30).padEnd(30)} | ${String(row[2]).slice(0, 28).padEnd(28)} | ${String(row[13]).padEnd(6)} ${String(row[14]).padEnd(10)} | ${String(row[16]).padEnd(6)} ${String(row[17]).padEnd(6)} | harga=${row[23]} | stok=${row[25]} | sku=${String(row[43]).slice(0, 20)} | bagan=${String(row[45] || "KOSONG").slice(-25)}`
  );
}
console.log("Output:", OUT);
