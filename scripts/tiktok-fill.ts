/**
 * Pengisi template resmi TikTok Shop (bulk upload) dengan data produk.
 *
 * Cara pakai:
 *   1. Unduh template dari Seller Center TikTok (Batch Tool > Download Template)
 *      lalu simpan ke folder tiktok-template/ (format .xlsx).
 *   2. (Opsional) Isi kolom "kategori_tiktok" di tiktok-export/kategori-mapping.csv
 *      dengan nama/path kategori TikTok.
 *   3. Jalankan: node scripts/tiktok-fill.ts
 *
 * Output: tiktok-export/TIKTOK-UPLOAD.xlsx (template + baris data terisi).
 *         tiktok-export/fill-report.txt (laporan kolom terpetakan).
 *
 * Header template dikenali lewat alias (Inggris/Indonesia). Kolom yang tidak
 * dikenali dibiarkan kosong dan dilaporkan agar bisa diisi manual.
 */
import * as fs from "node:fs";
import * as path from "node:path";
// xlsx adalah package CJS; di bawah ESM, named export hasil deteksi
// cjs-module-lexer tidak lengkap (readFile hilang). Ambil .default bila ada.
import * as XLSXNS from "xlsx";
const XLSX: typeof XLSXNS = (XLSXNS as any).default ?? XLSXNS;

const OUT_DIR = path.resolve("tiktok-export");
const TEMPLATE_DIR = path.resolve("tiktok-template");
const PRODUCTS_FILE = path.join(OUT_DIR, "products.json");
const KATEGORI_FILE = path.join(OUT_DIR, "kategori-mapping.csv");
const OUT_FILE = path.join(OUT_DIR, "TIKTOK-UPLOAD.xlsx");
const REPORT_FILE = path.join(OUT_DIR, "fill-report.txt");
const GUDANG_FILE = path.join(OUT_DIR, "warehouse-consolidation.csv");

// --- konsolidasi gudang ------------------------------------------------------
// TikTok multi-warehouse maks 20 pickup warehouse. 43 lokasi seller asli
// digabung jadi 18 gudang. Mapping ini ditulis ke warehouse-consolidation.csv
// (bisa diedit manual: tambah baris "lokasi_asli;gudang_tiktok").
const GUDANG_MAP: Record<string, string> = {
  "Jakarta Barat": "Gudang Jakarta",
  "Jakarta Utara": "Gudang Jakarta",
  "Jakarta Pusat": "Gudang Jakarta",
  "Jakarta Selatan": "Gudang Jakarta",
  "Jakarta Timur": "Gudang Jakarta",
  "Bekasi": "Gudang Jakarta",
  "Bogor": "Gudang Jakarta",
  "Tangerang": "Gudang Tangerang Raya",
  "Tangerang Selatan": "Gudang Tangerang Raya",
  "Bandung": "Gudang Bandung Raya",
  "Jawa Barat": "Gudang Bandung Raya",
  "Cirebon": "Gudang Cirebon",
  "Majalengka": "Gudang Cirebon",
  "Jawa Tengah": "Gudang Semarang Raya",
  "Semarang": "Gudang Semarang Raya",
  "Salatiga": "Gudang Semarang Raya",
  "Sukoharjo": "Gudang Semarang Raya",
  "Klaten": "Gudang Semarang Raya",
  "Ampel Boyolali": "Gudang Semarang Raya",
  "Kab Pekalongan": "Gudang Pekalongan",
  "Brebes": "Gudang Pekalongan",
  "Cilacap": "Gudang Cilacap",
  "Sragen": "Gudang Sragen",
  "Ngawi": "Gudang Ngawi",
  "Madiun": "Gudang Madiun",
  "Jombang": "Gudang Jombang",
  "Surabaya": "Gudang Surabaya",
  "Wiyung Surabaya": "Gudang Surabaya",
  "Jawa Timur": "Gudang Surabaya",
  "Sidoarjo": "Gudang Sidoarjo",
  "Gedangan Sidoarjo": "Gudang Sidoarjo",
  "Sooko Mojokerto": "Gudang Sidoarjo",
  "Malang": "Gudang Malang",
  "Malang Jatim": "Gudang Malang",
  "Sukun Malang": "Gudang Malang",
  "Jember": "Gudang Malang",
  "Istimewa Yogyakarta": "Gudang Yogyakarta",
  "Di Yogyakarta": "Gudang Yogyakarta",
  "Bantul": "Gudang Yogyakarta",
  "Balikpapan": "Gudang Balikpapan",
  "Jambi": "Gudang Jambi",
  "Lampung Barat": "Gudang Lampung",
};
const GUDANG_DEFAULT = "Gudang Jakarta"; // lokasi kosong/asing

function gudangOf(location: string): string {
  const key = (location ?? "").trim();
  if (!key) return GUDANG_DEFAULT;
  return GUDANG_MAP[key] ?? (GUDANG_MAP[key.toLowerCase()] ?? `Gudang ${key}`);
}

type Product = {
  id: string;
  name: string;
  location: string;
  category: string;
  description: string;
  price: number | null;
  stock: number | null;
  sku: string;
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  images: string[];
  alamatSeller?: string;
  error?: string;
};

// --- alias header template -> field ----------------------------------------

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type Field =
  | "name"
  | "category"
  | "description"
  | "mainImage"
  | "image2" | "image3" | "image4" | "image5" | "image6" | "image7" | "image8" | "image9"
  | "price"
  | "stock"
  | "sku"
  | "weightKg"
  | "lengthCm"
  | "widthCm"
  | "heightCm"
  | "warehouse"
  | "condition"
  | "status"
  | "brand";

const ALIASES: Record<Field, string[]> = {
  name: ["productname", "namaproduk", "producttitle", "judulproduk", "title"],
  category: ["category", "kategori", "categoryid", "categoryname", "kategoriproduk", "productcategory", "leafcategory", "categorypath"],
  description: ["description", "deskripsi", "deskripsiproduk", "productdescription"],
  mainImage: ["mainimage", "gambautama", "image1", "mainimageurl", "coverimage", "gambar1", "imageurl1", "mainimage1"],
  image2: ["image2", "gambar2", "imageurl2", "extraimage1", "additionalimage1"],
  image3: ["image3", "gambar3", "imageurl3", "extraimage2", "additionalimage2"],
  image4: ["image4", "gambar4", "imageurl4", "extraimage3", "additionalimage3"],
  image5: ["image5", "gambar5", "imageurl5", "extraimage4", "additionalimage4"],
  image6: ["image6", "gambar6", "imageurl6", "extraimage5", "additionalimage5"],
  image7: ["image7", "gambar7", "imageurl7", "extraimage6", "additionalimage6"],
  image8: ["image8", "gambar8", "imageurl8", "extraimage7", "additionalimage7"],
  image9: ["image9", "gambar9", "imageurl9", "extraimage8", "additionalimage8"],
  price: ["price", "harga", "sellingprice", "hargajual", "saleprice"],
  stock: ["stock", "stok", "quantity", "kuantitas", "inventory", "availablequantity"],
  sku: ["sellersku", "sku", "skuid", "productcode", "kodeproduk", "productsku", "externalid"],
  weightKg: ["packageweightkg", "weightkg", "beratkg", "weight", "berat", "packageweight"],
  lengthCm: ["packagelengthcm", "lengthcm", "panjangcm", "length", "panjang", "packagelength"],
  widthCm: ["packagewidthcm", "widthcm", "lebarcm", "width", "lebar", "packagewidth"],
  heightCm: ["packageheightcm", "heightcm", "tinggicm", "height", "tinggi", "packageheight"],
  warehouse: ["warehousename", "namagudang", "pickupwarehouse", "warehouse", "gudang", "warehouseid"],
  condition: ["condition", "kondisi", "itemcondition"],
  status: ["status", "productstatus", "listingstatus"],
  brand: ["brand", "merek"],
};

function fieldOf(header: string): Field | null {
  const n = norm(header);
  if (!n) return null;
  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(n)) return field as Field;
  }
  return null;
}

// --- util -------------------------------------------------------------------

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => {
      const out: string[] = [];
      let cur = "";
      let q = false;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (q) {
          if (ch === '"') {
            if (l[i + 1] === '"') { cur += '"'; i++; }
            else q = false;
          } else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === ";") { out.push(cur); cur = ""; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    });
}

function main() {
  if (!fs.existsSync(PRODUCTS_FILE)) {
    console.error("products.json belum ada. Jalankan dulu: node scripts/tiktok-collect.ts");
    process.exit(1);
  }
  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8")) as Product[];

  // Template: file .xlsx pertama di folder tiktok-template/
  const templates = fs
    .readdirSync(TEMPLATE_DIR)
    .filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"));
  if (!templates.length) {
    console.error(`Template tidak ditemukan di ${TEMPLATE_DIR}. Unduh dari Seller Center TikTok (Batch Tool > Download Template).`);
    process.exit(1);
  }
  const templatePath = path.join(TEMPLATE_DIR, templates[0]);
  console.log("Template:", templates[0]);

  // Mapping kategori (opsional, kolom kategori_tiktok).
  const katMap = new Map<string, string>();
  if (fs.existsSync(KATEGORI_FILE)) {
    for (const row of parseCsv(fs.readFileSync(KATEGORI_FILE, "utf8")).slice(1)) {
      const [asli, , tiktok] = row;
      if (asli && tiktok && tiktok.trim()) katMap.set(asli.trim(), tiktok.trim());
    }
  }
  console.log(`Mapping kategori terisi: ${katMap.size}`);

  const wb = XLSX.readFile(templatePath);
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1:A1");

  // Baca header baris pertama.
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
    headers.push(cell ? String(cell.v ?? "") : "");
  }
  const headerToField = new Map<number, Field | null>();
  const report: string[] = [`Template: ${templates[0]}`, `Sheet: ${wsName}`, ""];
  for (let c = 0; c < headers.length; c++) {
    const f = fieldOf(headers[c]);
    headerToField.set(c, f);
    report.push(`${XLSX.utils.encode_col(c)} "${headers[c]}" -> ${f ?? "TIDAK DIPETAKAN"}`);
  }

  const rows = products.map((p) => {
    const row: (string | number)[] = new Array(headers.length).fill("");
    for (let c = 0; c < headers.length; c++) {
      const f = headerToField.get(c);
      if (!f) continue;
      let v: string | number = "";
      switch (f) {
        case "name": v = p.name.slice(0, 255); break;
        case "category": v = p.category ? (katMap.get(p.category) ?? "") : ""; break;
        case "description": v = p.description.slice(0, 2500); break;
        case "mainImage": v = p.images[0] ?? ""; break;
        case "image2": case "image3": case "image4": case "image5":
        case "image6": case "image7": case "image8": case "image9": {
          const idx = parseInt(f.slice(5), 10) - 1; // imageN -> index
          v = p.images[idx] ?? "";
          break;
        }
        case "price": v = p.price ?? ""; break;
        case "stock": v = p.stock ?? ""; break;
        case "sku": v = p.sku; break;
        case "weightKg": v = p.weightKg ?? ""; break;
        case "lengthCm": v = p.lengthCm ?? ""; break;
        case "widthCm": v = p.widthCm ?? ""; break;
        case "heightCm": v = p.heightCm ?? ""; break;
        case "warehouse": v = gudangOf(p.location); break;
        case "condition": v = "Baru"; break;
        case "status": v = "Aktif"; break;
        case "brand": v = ""; break;
      }
      row[c] = v;
    }
    return row;
  });

  // Tulis mulai dari baris setelah header (baris contoh di template, jika ada,
  // tetap dipertahankan di atasnya? Tidak: mulai tepat setelah header).
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: range.s.r + 1 });

  // Ringkasan
  const mapped = [...headerToField.values()].filter((f) => f !== null).length;
  const tanpaHarga = products.filter((p) => p.price == null).length;
  const tanpaBerat = products.filter((p) => p.weightKg == null);
  const tanpaDimensi = products.filter((p) => p.lengthCm == null);
  const tanpaGambar = products.filter((p) => !p.images.length);
  const tanpaKategori = products.filter((p) => !p.category || !katMap.get(p.category));
  const gagal = products.filter((p) => p.error);
  const list = (arr: { id: string; name: string }[]) =>
    arr.map((p) => `${p.id}\t${p.name.slice(0, 60)}`).join("\n");

  // Konsolidasi gudang -> csv (untuk panduan setup di Seller Center)
  const gudangCount = new Map<string, number>();
  for (const p of products) gudangCount.set(gudangOf(p.location), (gudangCount.get(gudangOf(p.location)) ?? 0) + 1);
  const gudangRows = ["lokasi_asli;gudang_tiktok;jumlah_produk", ...Object.entries(GUDANG_MAP)
    .map(([asli, tiktok]) => `${asli};${tiktok};${products.filter((p) => (p.location ?? "").trim() === asli).length}`),
    ...products.filter((p) => !GUDANG_MAP[(p.location ?? "").trim()])
      .map((p) => `${p.location};${gudangOf(p.location)};1`)];
  fs.writeFileSync(GUDANG_FILE, "\ufeff" + gudangRows.join("\n"));

  report.push(
    "",
    `Baris data: ${rows.length}`,
    `Gudang unik: ${gudangCount.size}`,
    `Output: ${OUT_FILE}`,
    "",
    `PERLU DIISI MANUAL (produk tanpa BERAT): ${tanpaBerat.length}`,
    list(tanpaBerat),
    "",
    `PERLU DIISI MANUAL (produk tanpa DIMENSI): ${tanpaDimensi.length}`,
    list(tanpaDimensi),
    "",
    `PERLU DIISI MANUAL (produk tanpa kategori tiktok): ${tanpaKategori.length}`,
    list(tanpaKategori),
  );
  fs.writeFileSync(REPORT_FILE, report.join("\n"));

  fs.writeFileSync(OUT_FILE, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as unknown as Uint8Array);

  console.log(`Kolom template terpetakan: ${mapped}/${headers.length}`);
  console.log(`Baris ditulis: ${rows.length}`);
  console.log(`Produk gagal di-scrape: ${gagal.length}`);
  console.log(`Gudang unik: ${gudangCount.size} -> ${GUDANG_FILE}`);
  console.log(`Perhatian: tanpa harga ${tanpaHarga}, tanpa berat ${tanpaBerat.length}, tanpa dimensi ${tanpaDimensi.length}, tanpa gambar ${tanpaGambar.length}, kategori belum di-map ${tanpaKategori.length}`);
  console.log(`Laporan (termasuk daftar isi manual): ${REPORT_FILE}`);
}

main();
