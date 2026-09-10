/**
 * Pasca-proses products.json: menambal data yang gagal di-parse saat scrape.
 *
 * 1. Berat (weightKg): bila null, coba ambil dari deskripsi
 *    (pola "300gr" / "500 gram" / "60 g").
 * 2. Dimensi (length/width/heightCm): bila null, parse volumeText secara
 *    longgar (angka apa pun, koma desimal, pola "13 X 13 4", 2 angka ->
 *    diameter x diameter x tinggi).
 * 3. Lokasi sampah ("X Cm") -> "" agar masuk gudang default.
 *
 * Output: menimpa tiktok-export/products.json + laporan fix-report.txt.
 * Jalankan: node scripts/tiktok-fixdata.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

const OUT_DIR = path.resolve("tiktok-export");
const PRODUCTS_FILE = path.join(OUT_DIR, "products.json");

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
  weightText?: string;
  volumeText?: string;
  error?: string;
};

const NUM = /\d+(?:[.,]\d+)?/g;

function numbersIn(s: string): number[] {
  return (s.match(NUM) ?? []).map((n) => parseFloat(n.replace(",", ".")));
}

// Ambil berat (gram) pertama yang disebut di deskripsi.
function weightFromDesc(desc: string): number | null {
  const m = desc.match(/(\d+(?:[.,]\d+)?)\s*(?:gram|gr|g)\b/i);
  if (!m) return null;
  const gram = parseFloat(m[1].replace(",", "."));
  if (!isFinite(gram) || gram <= 0) return null;
  if (gram > 100000) return null; // jelas bukan berat
  return Math.round((gram / 1000) * 1000) / 1000; // gram -> kg, 3 desimal
}

function dimsFromVolume(text: string): [number, number, number] | null {
  const nums = numbersIn(text).filter((n) => isFinite(n) && n > 0);
  if (!nums.length) return null;
  if (nums.length === 1) return [nums[0], nums[0], nums[0]];
  if (nums.length === 2) return [nums[0], nums[0], nums[1]]; // diameter x diameter x tinggi
  return [nums[0], nums[1], nums[2]];
}

// Koreksi berat salah ketik di situs supplier (cek ulang dengan seller!).
// 1735: "50200.00 Gram" utk pembersih 5 Liter -> ~5.5 kg (isi + jerigen)
// 1158: "19500.00 Gram" utk madu botol 7x7x15cm -> mengikuti saudaranya (300gr)
const WEIGHT_FIX: Record<string, number> = { "1735": 5.5, "1158": 0.3 };

function main() {
  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8")) as Product[];
  const report: string[] = [];
  let wFixed = 0, dFixed = 0, lFixed = 0;

  for (const p of products) {
    // 0) koreksi berat typo supplier
    if (WEIGHT_FIX[p.id] != null) {
      report.push(`KOREKSI berat typo ${p.id} ${p.weightKg} kg -> ${WEIGHT_FIX[p.id]} kg (CEK ULANG!)`);
      p.weightKg = WEIGHT_FIX[p.id];
    }
    // 1) berat dari deskripsi
    if (p.weightKg == null) {
      const w = weightFromDesc(p.description ?? "");
      if (w != null) { p.weightKg = w; wFixed++; report.push(`berat desc ${p.id} -> ${w} kg`); }
    }
    // 2) dimensi longgar dari volumeText
    if (p.lengthCm == null || p.widthCm == null || p.heightCm == null) {
      const d = dimsFromVolume(p.volumeText ?? "");
      if (d) {
        p.lengthCm = d[0]; p.widthCm = d[1]; p.heightCm = d[2];
        dFixed++;
        report.push(`dimensi ${p.id} "${p.volumeText}" -> ${d.join(" x ")} cm`);
      }
    }
    // 3) lokasi sampah
    if (/^\s*X\s+Cm\s*$/i.test(p.location ?? "")) {
      report.push(`lokasi sampah ${p.id} "${p.location}" -> ""`);
      p.location = "";
      lFixed++;
    }
  }

  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
  fs.writeFileSync(
    path.join(OUT_DIR, "fix-report.txt"),
    [`Berat ditambal: ${wFixed}`, `Dimensi ditambal: ${dFixed}`, `Lokasi ditambal: ${lFixed}`, "", ...report].join("\n")
  );
  console.log(`Selesai. berat +${wFixed}, dimensi +${dFixed}, lokasi ${lFixed}`);
}

main();
