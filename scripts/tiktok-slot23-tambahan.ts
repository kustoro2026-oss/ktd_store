/**
 * tiktok-slot23-tambahan.ts — Bangun 3 file siap-upload "TAMBAHAN" (23 slot
 * berikutnya: herbal & obat pertanian) TANPA menyentuh produk yang sudah live.
 *
 * Aturan yang dipatuhi (hasil riset format & kesalahan historis):
 *  1. Gambar HANYA dari tiktok-export/images-clean.json (galeri bersih hasil
 *     refresh + verifikasi visual 23/23). Produk A = gambar A.
 *  2. Kategori: categoryCell dari category-map.json, "(ID)" DIBUANG
 *     (format terbukti live pada t8-FIX/t9-FIX).
 *  3. Atribut tersembunyi (HiddenStyle):
 *     - t6 (Tanah untuk Berkebun & Pupuk / Benih Bunga & Tanaman): kolom 47-58
 *       Forbid -> dibiarkan kosong (array 59 kolom).
 *     - t9 (Perlengkapan Kesehatan Hewan Ternak): tidak ada atribut wajib
 *       (array 57 kolom, sama seperti t9-FIX yang sudah live).
 *     - t1 (Obat Herbal): kolom 57 = "Contains dangerous goods?" (ID:101734)
 *       WAJIB -> diisi "Tidak" (array 61 kolom; pola sama t8-FIX live).
 *  4. Varian: hanya produk dengan >1 varian asli (variants-fix.json) yang
 *     dibuatkan baris varian; nama axis dipaksa "Varian" agar nama bibit yang
 *     mengandung kata warna (mis. "Bayam Hijau") tidak salah jadi axis Warna.
 *     Varian tunggal/tanpa varian = 1 baris SKU.
 *  5. Deskripsi: dibersihkan dari penanda internal "META ADS"; jika kosong
 *     dipakai deskripsi generik (nama + kalimat kategori).
 *  6. Baris data ditulis mulai 0-based 5 (baris contoh); baris instruksi
 *     (0-based 4) & baris signature tersembunyi dipertahankan (fixRef).
 *
 * Output:
 *  - tiktok-upload/t6-Renovasi Rumah-TAMBAHAN.xlsx                    (11 produk)
 *  - tiktok-upload/t9-Perlengkapan Hewan Peliharaan-TAMBAHAN.xlsx     (6 produk)
 *  - tiktok-upload/t1-Kesehatan-TAMBAHAN.xlsx                         (6 produk)
 * Jalankan: npx --yes tsx scripts/tiktok-slot23-tambahan.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { isWaOnlyProduct } from "../src/lib/config";
import * as XLSXNS from "xlsx";
const XLSX: any = (XLSXNS as any).default ?? XLSXNS;

type Job = {
  label: string;
  tpl: string;
  out: string;
  /** Panjang array baris = jumlah kolom fisik (mengikuti HiddenStyle template). */
  cols: number;
  /** Kolom atribut wajib "Contains dangerous goods?" -> "Tidak" (t1 saja). */
  dgCol: number | null;
  /** Suffix nama jika < 25 karakter. */
  suffix: string;
  ids: number[];
};

const JOBS: Job[] = [
  {
    label: "t6",
    tpl: "tiktok-upload/t6-Renovasi Rumah.xlsx",
    out: "tiktok-upload/t6-Renovasi Rumah-TAMBAHAN.xlsx",
    cols: 59,
    dgCol: null,
    suffix: " - Perlengkapan Taman Berkualitas",
    ids: [1448, 1447, 1446, 1648, 1359, 1358, 1781, 1552, 1670, 1698, 1702],
  },
  {
    label: "t9",
    tpl: "tiktok-upload/t9-Perlengkapan Hewan Peliharaan.xlsx",
    out: "tiktok-upload/t9-Perlengkapan Hewan Peliharaan-TAMBAHAN.xlsx",
    cols: 57,
    dgCol: null,
    suffix: " - Perlengkapan Hewan Ternak Berkualitas",
    ids: [1644, 1639, 1997, 1637, 1809, 1754],
  },
  {
    label: "t1",
    tpl: "tiktok-upload/t1-Kesehatan.xlsx",
    out: "tiktok-upload/t1-Kesehatan-TAMBAHAN.xlsx",
    cols: 61,
    dgCol: 57,
    suffix: " - Produk Kesehatan Herbal Alami",
    ids: [1667, 1777, 1840, 1222, 1750, 721],
  },
];

const PRODUCTS = JSON.parse(fs.readFileSync(path.resolve("tiktok-export/products.json"), "utf8"));
const CLEAN = JSON.parse(fs.readFileSync(path.resolve("tiktok-export/images-clean.json"), "utf8"));
const CMAP = JSON.parse(fs.readFileSync(path.resolve("tiktok-export/category-map.json"), "utf8"));
const VFIX = JSON.parse(fs.readFileSync(path.resolve("tiktok-export/variants-fix.json"), "utf8"));
const byId = new Map<string, any>(PRODUCTS.map((p: any) => [String(p.id), p]));

/** Deskripsi generik cadangan (produk tanpa deskripsi di sumber). */
const FALLBACK_DESC: Record<string, string> =
{
  "1781": "Benih Unggul Fertani Berbagai Varian – benih sayur dan buah unggul untuk kebun, pekarangan, pot, dan polybag.\n\nTersedia banyak pilihan varian benih berkualitas, silakan pilih varian yang diinginkan sebelum checkout. Dikemas rapi dan aman untuk pengiriman.\n\nCocok untuk petani, pehobi tanaman, hingga pemula yang ingin mulai bercocok tanam.",
};

function cleanImg(u: unknown): string {
  const s = String(u ?? "").trim();
  if (!s) return "";
  const m = s.match(/[?&]url=(https?%3A%2F%2F[^&]+)/i);
  if (m) return decodeURIComponent(m[1]);
  return s;
}

/** Bersihkan penanda internal pemasaran dari deskripsi. */
function cleanDesc(s: string): string {
  return String(s ?? "")
    .replace(/\[\s*khusus penjualan meta ads\s*\]/gi, "")
    .replace(/dijual only meta ads/gi, "")
    .replace(/\bmeta\s*ads\b/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2000);
}

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

const sanitize = (s: unknown, max = 50) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function buildJob(job: Job) {
  console.log(`\n########## ${job.label} -> ${path.basename(job.out)} ##########`);
  const wb = XLSX.readFile(path.resolve(job.tpl));
  const ws = wb.Sheets["Template"];
  const rows: any[][] = [];

  for (const id of job.ids) {
    const p = byId.get(String(id));
    if (!p) { console.error(`  !! #${id} TIDAK ADA di products.json`); continue; }
    if (isWaOnlyProduct(p.name)) {
      console.error(`  !! #${id} parfum WA-only/terblokir (HKI) - DILEWATI, tidak boleh diupload`);
      continue;
    }
    const cm = CMAP[String(id)];
    if (!cm || !cm.categoryCell) { console.error(`  !! #${id} tanpa categoryCell - DILEWATI`); continue; }
    const kat = String(cm.categoryCell).replace(/\s*\(\d+\)\s*$/, "").trim();
    const clean = CLEAN[String(id)];
    const imgs = ((clean?.urls ?? []) as string[]).map(cleanImg).filter((u) => u.startsWith("http")).slice(0, 9);
    if (!imgs.length) { console.error(`  !! #${id} tanpa gambar bersih - DILEWATI`); continue; }

    let name = String(p.name || "").trim().slice(0, 255);
    if (name.length < 25) name = (name + job.suffix).slice(0, 255);
    let desc = cleanDesc(String(p.description || ""));
    if (!desc) desc = FALLBACK_DESC[String(id)] ?? (name + "\n\nProduk berkualitas dari KTD Store. Silakan chat kami untuk informasi lebih lanjut mengenai produk ini.");
    const weightG = p.weightKg != null && p.weightKg > 0 ? Math.max(1, Math.round(p.weightKg * 1000)) : 500;
    const len = p.lengthCm > 0 ? p.lengthCm : 10;
    const wid = p.widthCm > 0 ? p.widthCm : 10;
    const hei = p.heightCm > 0 ? p.heightCm : 10;
    const price = p.price != null && p.price > 0 ? Number(p.price) : "";
    const stock = p.stock != null && p.stock > 0 ? Math.floor(Number(p.stock)) : 100;

    // Varian asli (hanya produk multi-varian, mis. Benih Unggul Fertani #1781).
    const vraw = (VFIX[String(id)] ?? []).filter((v: any) => v.active !== false && (v.stock == null || v.stock > 0));
    const useVariants = vraw.length > 1;

    const pushRow = (v: any | null) => {
      const row: any[] = new Array(job.cols).fill("");
      row[0] = kat;
      row[1] = "";
      row[2] = name;
      row[3] = desc;
      for (let i = 0; i < 9; i++) row[4 + i] = imgs[i] ?? "";
      if (v) {
        // Nama axis DIPAKSA "Varian": nama bibit bisa mengandung kata warna
        // (mis. "Bayam Hijau") sehingga tidak boleh jadi axis "Warna".
        row[13] = "Varian";
        row[14] = sanitize(v.name, 50);
        row[15] = "";
        row[16] = "";
        row[17] = "";
      }
      row[18] = weightG;
      row[19] = len;
      row[20] = wid;
      row[21] = hei;
      row[22] = "";
      let rowPrice: number | string = price;
      if (v && v.price != null && Number(v.price) > 0) {
        const vp = Number(v.price);
        rowPrice = price !== "" ? Math.max(1000, Math.round((vp * Number(price)) / vp)) : Math.round(vp);
      }
      row[23] = rowPrice;
      row[24] = "";
      row[25] = v && v.stock != null && v.stock > 0 ? Math.floor(Number(v.stock)) : stock;
      row[26] = "";
      row[27] = "";
      if (job.dgCol != null) row[job.dgCol] = "Tidak"; // "Contains dangerous goods?" wajib
      rows.push(row);
    };

    if (useVariants) {
      const seen = new Set<string>();
      for (const v of vraw) {
        const val = sanitize(v.name, 50);
        if (!val || seen.has(val)) continue;
        seen.add(val);
        pushRow(v);
      }
      console.log(`  #${id} ${name.slice(0, 42)} -> ${seen.size} baris varian`);
    } else {
      pushRow(null);
      console.log(`  #${id} ${name.slice(0, 42)} -> 1 baris (SKU tunggal)`);
    }
  }

  // Tulis: hapus baris data lama (>= 5), pertahankan instruksi (row 4) & signature.
  for (const k of Object.keys(ws)) {
    if (k[0] === "!") continue;
    const c = XLSX.utils.decode_cell(k);
    if (c.r >= 5) delete ws[k];
  }
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: 5 });
  for (const sn of wb.SheetNames) fixRef(wb.Sheets[sn]);
  XLSX.writeFile(wb, path.resolve(job.out));

  // Verifikasi baca ulang
  const wb2 = XLSX.readFile(path.resolve(job.out));
  const t = XLSX.utils.sheet_to_json(wb2.Sheets["Template"], { header: 1, defval: "" });
  console.log(`  signature A1=${JSON.stringify(wb2.Sheets["Template"]["A1"]?.v)} A2=${JSON.stringify(wb2.Sheets["Template"]["A2"]?.v)}`);
  let wsrv = 0, nonHttp = 0, dataRows = 0;
  for (let r = 5; r < t.length; r++) {
    const row = t[r];
    if (!String(row[0] ?? "").trim()) continue;
    dataRows++;
    for (let i = 4; i <= 12; i++) {
      const u = String(row[i] ?? "");
      if (!u) continue;
      if (u.includes("wsrv.nl")) wsrv++;
      if (!u.startsWith("http")) nonHttp++;
    }
    const img = String(row[4] || "");
    console.log(
      `    [${r + 1}] ${String(row[0]).slice(-38).padEnd(38)} | ${String(row[2]).slice(0, 34).padEnd(34)} | ${String(row[13]).padEnd(6)}:${String(row[14]).slice(0, 12).padEnd(12)} | harga=${row[23]} | stok=${row[25]} | dg57=${job.dgCol != null ? row[job.dgCol] : "-"} | img=${img.slice(-32)}`
    );
  }
  console.log(`  TOTAL: ${dataRows} baris data | wsrv=${wsrv} | non-http=${nonHttp} | output=${job.out}`);
  return dataRows;
}

let total = 0;
for (const job of JOBS) total += buildJob(job);
console.log(`\nSEMUA SELESAI. Total baris data: ${total}`);
