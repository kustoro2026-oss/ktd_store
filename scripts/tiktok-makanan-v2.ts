import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const IN = path.join(__dirname, "..", "tiktok-upload", "t7-Makanan & Minuman.xlsx");
const OUT = path.join(__dirname, "..", "tiktok-upload", "t7-Makanan & Minuman-V2.xlsx");
const PRODUCTS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tiktok-export", "products.json"), "utf8"));
const PLIST: any[] = Array.isArray(PRODUCTS) ? PRODUCTS : PRODUCTS.data ?? PRODUCTS.products ?? [];

const wb = XLSX.readFile(IN);
const ws = wb.Sheets["Template"];

function get(r: number, c: number): unknown {
  return ws[XLSX.utils.encode_cell({ r, c })]?.v;
}
function setCell(r: number, c: number, v: unknown) {
  ws[XLSX.utils.encode_cell({ r, c })] = { t: v === undefined ? "z" : typeof v === "number" ? "n" : "s", v };
}

const NL = String.fromCharCode(10);

function cleanDesc5(d: unknown): string {
  let out = String(d ?? "");
  out = out.replace(/^\s*DIJUAL\s+ONLY\s+META\s+ADS/i, "");
  out = out.replace(/META\s+ADS\s+ONLY[\s\S]*?TOKOPEDIA\s*\)/gi, "");
  const gi = out.toLowerCase().indexOf("panduan aman upload produk");
  if (gi >= 0) out = out.slice(0, gi);
  const ei = out.search(/\.\s*Ekspedisi/i);
  if (ei >= 0) out = out.slice(0, ei + 1);
  out = out
    .split(NL)
    .filter((l) => l.trim() !== "---")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join(NL);
  out = out.replace(new RegExp("(?:" + NL + "){3,}", "g"), NL + NL);
  return out.trim().slice(0, 2000);
}

// Bersihkan segmen izin PB UMKU (untuk kedelai yang dipindah ke kategori aman)
function stripPBUMKU(d: unknown): string {
  return String(d ?? "").replace(/Izin\s+PB\s+UMKU\s*:?\s*\d+[\d.]*\s*/gi, "");
}

// Hapus wrapper wsrv.nl jika ada
function cleanImg(u: unknown): string {
  const s = String(u ?? "").trim();
  if (!s) return "";
  const m = s.match(/[?&]url=(https?%3A%2F%2F[^&]+)/i);
  if (m) return decodeURIComponent(m[1]);
  return s;
}

const usedSku = new Set<string>();
function newSku(): string {
  let s = "";
  do {
    s = "MKN-" + Math.random().toString(36).slice(2, 10).toUpperCase();
  } while (usedSku.has(s));
  usedSku.add(s);
  return s;
}

type RowSpec = {
  nama: string;
  kategori: string;
  desc: string;
  harga: number;
  berat: number;
  dims: [number, number, number];
  stok: number;
  imgs: string[];
  cert58?: string;
  cert59?: string;
};

const rows: RowSpec[] = [];

// ==== 7 produk lama (rename) dari baris 7-13 template ====
type Old = {
  src: number;
  nama: string;
  kategori: string;
  cert58?: string;
  cert59?: string;
  stripIzin?: boolean;
};
const olds: Old[] = [
  { src: 7, nama: "Cuka Sari Apel Organik 500ml With Mother - Apple Cider Vinegar Murni Alami", kategori: "Bahan Makanan & Peralatan Memasak Pokok/Cuka (919560)", cert58: "SPP-IRT", cert59: "1073506040538-28" },
  { src: 8, nama: "Sari Lemon California Murni 500ml - Perasan Lemon Asli Segar Tanpa Pengawet", kategori: "Minuman/Minuman Non-Alkohol (917384)", cert58: "BPOM", cert59: "MD266237001958" },
  { src: 9, nama: "Susu Kacang Kedelai Bubuk Murni 200gr - Soy Bean Milk Powder Tanpa Gula", kategori: "Bahan Makanan & Peralatan Memasak Pokok/Kacang-kacangan & Biji-bijian (918152)", stripIzin: true },
  { src: 10, nama: "Susu Kacang Kedelai Bubuk Murni 1kg - Soy Bean Milk Powder Tinggi Protein", kategori: "Bahan Makanan & Peralatan Memasak Pokok/Kacang-kacangan & Biji-bijian (918152)", stripIzin: true },
  { src: 11, nama: "Sari Lemon Detoks California 250ml - Jus Perasan Lemon Murni Asli Berkualitas", kategori: "Minuman/Minuman Non-Alkohol (917384)", cert58: "BPOM", cert59: "MD266237001958" },
  { src: 12, nama: "Nutrivit Cuka Apel With Mother 250ml - Fermentasi Alami Tanpa Pengawet Kimia", kategori: "Bahan Makanan & Peralatan Memasak Pokok/Cuka (919560)", cert58: "SPP-IRT", cert59: "1073506040538-28" },
  { src: 13, nama: "Madu Bawang Hitam Tunggal 250ml - Black Garlic Honey Fermentasi Herbal Alami", kategori: "Minuman/Minuman Non-Alkohol (917384)", cert58: "SPP-IRT", cert59: "2071571011084-29" },
];

for (const o of olds) {
  const imgs: string[] = [];
  for (let c = 4; c <= 12; c++) {
    const u = cleanImg(get(o.src, c));
    if (u) imgs.push(u);
  }
  const uniqImgs = [...new Set(imgs)];
  const stok = Number(get(o.src, 29) ?? get(o.src, 39) ?? get(o.src, 25) ?? 0);
  let desc = String(get(o.src, 3) ?? "");
  if (o.stripIzin) desc = stripPBUMKU(desc);
  rows.push({
    nama: o.nama,
    kategori: o.kategori,
    desc,
    harga: Number(get(o.src, 23) ?? 0),
    berat: Number(get(o.src, 18) ?? 0),
    dims: [Number(get(o.src, 19) ?? 1), Number(get(o.src, 20) ?? 1), Number(get(o.src, 21) ?? 1)],
    stok,
    imgs: uniqImgs,
    cert58: o.cert58,
    cert59: o.cert59,
  });
}

// ==== 5 produk baru ====
type NewP = { id: number; kategori: string; nama: string; beratFallback: number };
const news: NewP[] = [
  { id: 1118, kategori: "Bahan Makanan & Peralatan Memasak Pokok/Kacang-kacangan & Biji-bijian (918152)", nama: "Black Chia Seed 100gr Kaya Antioksidan", beratFallback: 110 },
  { id: 1119, kategori: "Bahan Makanan & Peralatan Memasak Pokok/Kacang-kacangan & Biji-bijian (918152)", nama: "Black Chia Seed 200gr Premium", beratFallback: 250 },
  { id: 1221, kategori: "Makanan Ringan/Camilan Nabati & Bebas Gluten (851856)", nama: "Kurma Berkah - Premium Kurma Pilihan", beratFallback: 500 },
  { id: 370, kategori: "Bahan Makanan & Peralatan Memasak Pokok/Bumbu, Rempah & Bumbu (919176)", nama: "Great Vanilla Bean Gourmet 2 pods", beratFallback: 10 },
  { id: 369, kategori: "Bahan Makanan & Peralatan Memasak Pokok/Bumbu, Rempah & Bumbu (919176)", nama: "Great Vanilla Bean Gourmet 1 pods", beratFallback: 10 },
];

for (const n of news) {
  const f = PLIST.find((x: any) => (x.id ?? x.product_id) == n.id);
  if (!f) throw new Error("produk id " + n.id + " tidak ditemukan");
  const imgs: string[] = [];
  for (let i = 0; i <= 8; i++) {
    const v = f["image" + i] ?? f.images?.[i];
    const u = cleanImg(v);
    if (u) imgs.push(u);
  }
  const uniqImgs = [...new Set(imgs)];
  const berat = Number(f.weightGram ?? 0) > 0 ? Number(f.weightGram) : n.beratFallback;
  const dims: [number, number, number] = [
    Number(f.lengthCm) > 0 ? Number(f.lengthCm) : 2,
    Number(f.widthCm) > 0 ? Number(f.widthCm) : 5,
    Number(f.heightCm) > 0 ? Number(f.heightCm) : 10,
  ];
  rows.push({
    nama: n.nama,
    kategori: n.kategori,
    desc: cleanDesc5(f.description),
    harga: Number(f.price ?? 0),
    berat,
    dims,
    stok: Number(f.stock ?? 0),
    imgs: uniqImgs,
  });
}

// ==== bersihkan baris data lama lalu tulis 12 baris baru mulai baris 7 ====
const delKeys: string[] = [];
for (const k of Object.keys(ws)) {
  if (k[0] === "!") continue;
  if (XLSX.utils.decode_cell(k).r >= 6) delKeys.push(k);
}
for (const k of delKeys) delete ws[k];

let outR = 6;
for (const spec of rows) {
  setCell(outR, 0, spec.kategori);
  setCell(outR, 2, spec.nama);
  setCell(outR, 3, spec.desc);
  spec.imgs.forEach((u, i) => {
    if (i < 9) setCell(outR, 4 + i, u);
  });
  setCell(outR, 18, spec.berat);
  setCell(outR, 19, spec.dims[0]);
  setCell(outR, 20, spec.dims[1]);
  setCell(outR, 21, spec.dims[2]);
  setCell(outR, 23, spec.harga);
  setCell(outR, 29, spec.stok);
  setCell(outR, 43, newSku());
  if (spec.cert58) setCell(outR, 58, spec.cert58);
  if (spec.cert59) setCell(outR, 59, spec.cert59);
  outR++;
}

ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: outR - 1, c: 62 } });
XLSX.writeFile(wb, OUT);

// ==== verifikasi ====
const wb2 = XLSX.readFile(OUT);
const ws2 = wb2.Sheets["Template"];
const g2 = (r: number, c: number) => ws2[XLSX.utils.encode_cell({ r, c })]?.v;
console.log("A1:", g2(0, 0), "| A2:", g2(1, 0), "| header:", String(g2(2, 0) ?? ""));
console.log("=== 12 baris data ===");
for (let r = 6; r <= 17; r++) {
  const nama = String(g2(r, 2) ?? "");
  const kat = String(g2(r, 0) ?? "").slice(0, 55);
  const imgs = [];
  for (let c = 4; c <= 12; c++) if (String(g2(r, c) ?? "").trim()) imgs.push(c);
  console.log(
    r,
    "| len:" + nama.length,
    "| h:" + g2(r, 23),
    "| b:" + g2(r, 18),
    "| img:" + imgs.length,
    "| stok:" + g2(r, 29),
    "| sku:" + String(g2(r, 43) ?? ""),
    "| 58:" + String(g2(r, 58) ?? ""),
    "| 59:" + String(g2(r, 59) ?? ""),
    "| " + nama.slice(0, 45)
  );
}
