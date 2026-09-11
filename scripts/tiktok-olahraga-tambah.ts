/**
 * Tambah produk Olahraga & Outdoor ke t12-FIX dari katalog supplier.
 *
 * Isi akhir file FIX:
 *  - 2 produk lama (ESSEN IKAN EMAS R-46, Shoe Clean Shoe Parfume) dibangun
 *    ulang dari template t12 (kategori DENGAN suffix ID seperti template asli,
 *    deskripsi dibersihkan dari alamat seller, URL wsrv -> langsung).
 *  - Produk baru dari tiktok-export/products.json:
 *      * Memancing (603818): umpan/essen pancing
 *      * Aksesori Sepatu Olahraga (1001480): pembersih sepatu
 *      * Tinju & Seni Bela Diri (603288): kipas Tai Chi
 *  - Produk ber-varian DIPECAH per varian (kolom 13/14: "Varian"/nilai)
 *    mengikuti pola t2-Pakaian Anak-FIX.
 *
 * Kategori target TIDAK punya atribut tersembunyi wajib (kolom 47-57
 * Optional/Forbid) -> dibiarkan kosong.
 *
 * Jalankan: node scripts/tiktok-olahraga-tambah.ts
 * Output:  tiktok-upload/t12-Olahraga & Outdoor-FIX.xlsx
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSXNS from "xlsx";
const XLSX: any = (XLSXNS as any).default ?? XLSXNS;

const TPL = path.resolve("tiktok-upload/t12-Olahraga & Outdoor.xlsx");
const OUT = path.resolve("tiktok-upload/t12-Olahraga & Outdoor-FIX.xlsx");
const PRODUCTS_FILE = path.resolve("tiktok-export/products.json");

const CAT_MEMANCING = "Peralatan Bersantai & Rekreasi Outdoor/Memancing (603818)";
const CAT_SEPATU = "Alas Kaki Olahraga/Aksesori Sepatu Olahraga (1001480)";
const CAT_BELADIRI = "Peralatan Bersantai & Rekreasi Outdoor/Tinju & Seni Bela Diri (603288)";

const BROKEN_URL = "https://anekadropship.id/uploads/products/1769842384_697da6d0e28da.webp";

// Lepas wrapper wsrv.nl -> URL langsung
function cleanImg(u: unknown): string {
  const s = String(u ?? "").trim();
  if (!s) return "";
  const m = s.match(/[?&]url=(https?%3A%2F%2F[^&]+)/i);
  if (m) return decodeURIComponent(m[1]);
  return s;
}

// Bersihkan deskripsi: buang panduan internal, META ADS, marketing kit, alamat
function cleanDesc(d: unknown): string {
  let out = String(d ?? "");
  const gi = out.toLowerCase().indexOf("panduan aman upload produk");
  if (gi >= 0) out = out.slice(0, gi);
  out = out.replace(/META\s+ADS\s+ONLY[\s\S]*?TOKOPEDIA\s*\)/gi, "");
  out = out.replace(/(?<=^|>|[.!?:]\s)(?:(?![.!?:])[^<])*marketing[\s-]*kit(?:(?![.!?])[^<])*[.!?]?/gi, "");
  const ai = out.search(/alamat\s*:/i);
  if (ai >= 0) out = out.slice(0, ai);
  const NL = String.fromCharCode(10);
  out = out.split(NL).map((l) => l.replace(/[ \t]+$/, "")).join(NL);
  out = out.replace(new RegExp("(?:" + NL + "){3,}", "g"), NL + NL);
  return out.trim().slice(0, 2000);
}

// Deskripsi cadangan jika produk supplier tidak punya deskripsi
function descFallback(kat: string, nama: string): string {
  const n = nama.replace(/^[-–\s]+/, "").trim();
  let gen = "";
  if (kat.startsWith("Peralatan Bersantai & Rekreasi Outdoor/Memancing")) {
    gen = "Perisa umpan pancing beraroma kuat untuk memancing harian, galatama, dan lomba. Membantu meningkatkan daya tarik umpan sehingga ikan lebih cepat menyambar. Praktis dibawa dan mudah digunakan.";
  } else if (kat.startsWith("Alas Kaki Olahraga")) {
    gen = "Perawatan sepatu praktis untuk menjaga sepatu tetap bersih, wangi, dan tahan lama. Mudah digunakan untuk berbagai jenis bahan sepatu.";
  } else {
    gen = "Alat latihan olahraga yang praktis dan nyaman digunakan. Cocok untuk pemula maupun yang sudah terbiasa berlatih.";
  }
  return (n + ". " + gen).slice(0, 2000);
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

// ---- Cocokkan nama ke produk supplier (untuk stok) ----
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
    for (const t of toks) if (pt.includes(t)) score += 1;
    if (score === 0) continue;
    const numsP = nums(p.name);
    if (numsT.length && numsP.length && numsT[0] !== numsP[0]) score -= 5;
    if (!best || score > best.score) best = { score, p };
  }
  if (best && best.score >= 2) return { name: best.p.name, stock: Number(best.p.stock) || 0 };
  return null;
}

// ---- Bangun satu baris 58 kolom dari data mentah ----
function buildRow(opts: {
  kat: string;
  nama: string;
  desc: string;
  imgs: unknown[];
  berat: number;
  dims: [number, number, number];
  harga: number;
  stok: number;
  pn1?: string;
  pv1?: string;
}): any[] {
  const row: any[] = new Array(58).fill("");
  row[0] = opts.kat;
  row[1] = "";
  let nama = opts.nama.replace(/^[-–\s]+/, "").trim().slice(0, 255);
  if (nama.length < 25) nama = (nama + " - Olahraga & Outdoor Berkualitas").slice(0, 255);
  row[2] = nama;
  row[3] = opts.desc;
  const imgs = (opts.imgs || [])
    .map(cleanImg)
    .filter((u) => u && u !== BROKEN_URL)
    .slice(0, 9);
  for (let i = 0; i < imgs.length; i++) row[4 + i] = imgs[i];
  row[13] = opts.pn1 ?? "";
  row[14] = opts.pv1 ?? "";
  row[15] = "";
  row[16] = "";
  row[17] = "";
  row[18] = opts.berat > 0 ? opts.berat : 100;
  row[19] = opts.dims[0];
  row[20] = opts.dims[1];
  row[21] = opts.dims[2];
  row[22] = "";
  row[23] = Math.round(opts.harga) || "";
  row[24] = "";
  row[25] = Math.max(0, Math.round(opts.stok));
  row[26] = "";
  row[27] = "";
  return row;
}

// ---- 1) Dua produk lama dari template t12 ----
const wb = XLSX.readFile(TPL);
const ws = wb.Sheets["Template"];
const get = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v;

const rows: any[][] = [];
for (const r of [7, 8]) {
  const nama = String(get(r, 2) ?? "").trim();
  const kat = String(get(r, 0) ?? "").trim();
  const desc = cleanDesc(get(r, 3));
  const imgs: unknown[] = [];
  for (let i = 0; i < 9; i++) imgs.push(get(r, 4 + i));
  const sup = findSupplier(nama);
  const stok = sup && sup.stock > 0 ? sup.stock : 100;
  console.log(`[LAMA] ${nama.slice(0, 45)} | stok ${stok}${sup ? ` (${sup.name.slice(0, 35)})` : " FALLBACK"}`);
  rows.push(
    buildRow({
      kat, nama, desc, imgs,
      berat: Number(get(r, 18) ?? 0) || 100,
      dims: [Number(get(r, 19) ?? 0) || 10, Number(get(r, 20) ?? 0) || 10, Number(get(r, 21) ?? 0) || 10],
      harga: Number(get(r, 23) ?? 0),
      stok,
    })
  );
}

// ---- 2) Produk baru dari supplier ----
const byName = (n: string) => SUPPLIER.find((p) => String(p.name).toLowerCase() === n.toLowerCase());

// Memancing — tanpa varian
const PLAIN_MEMANCING = [
  "FERTANI Umpan Pancing 120X Udang Antartika Netto 30g",
  "FERTANI Umpan Pancing 120X Cacing Bloodworm 30gr",
  "FERTANI Essen Ikan 120X Kapsul Formula Ikan Kolam",
  "- FERTANI Essen Ikan 120X Kapsul Formula Ikan Liar",
  "FERTANI Essen Ikan Cair 120X Formula Konsentrat - Penambah Aroma Umpan Pancing Air Tawar (Netto 100ml)",
  "Fertani Umpan Pancing 120X",
  "ESSEN XTREME IKAN LELE 60ml",
  "ESSEN XTREME IKAN LELE 30ml",
  "ESSEN CHINA",
  "ESSEN JAHAT STRIKE R-46",
  "ESSEN LUMUT R-46 65ml",
  "ESSEN IKAN BAWAL R-46 65ml",
  "ESSEN IKAN EMAS BRO AZMI 65ml",
  "ESSEN IKAN PATIN BRO AZMI 65ml",
  "ESSEN IKAN BAWAL BRO AZMI 65ml",
  // varian tunggal -> baris polos
  "Essen Pancing Power 30 ml Berbagai Varian – Perisa Umpan untuk Galatama, Harian, dan Lomba",
  "Essen Pancing Power 60 ml Berbagai Varian – Perisa Umpan untuk Galatama, Harian, dan Lomba",
];
// Memancing — pecah per varian
const VARIANT_MEMANCING = [
  "Essen Strike Racun 30 ml – Perisa Umpan Galatama, Harian, dan Lomba",
  "Essen Strike Racun 60 ml – Perisa Umpan Galatama, Harian, dan Lomba",
  "Essen Tarik Hantam 30 ml Berbagai Varian – Perisa Umpan Galatama dan Mancing Harian",
  "Essen Tarik Hantam 60 ml Berbagai Varian – Perisa Umpan Galatama dan Mancing Harian",
  "Boom Essen 30 ml Berbagai Varian – Perisa Umpan Galatama dan Mancing Harian",
  "Boom Essen 60 ml Berbagai Varian – Perisa Umpan Galatama dan Mancing Harian",
  "Essen Kailtorque 30 ml Berbagai Varian – Perisa Umpan Galatama, Harian, dan Lomba",
  "Essen Kailtorque 60 ml Berbagai Varian – Perisa Umpan Galatama, Harian, dan Lomba",
  "Essen Monster Tegang 30 ml Berbagai Varian – Perisa Umpan Galatama dan Mancing Harian",
  "Essen Monster Tegang 60 ml Berbagai Varian – Perisa Umpan Galatama dan Mancing Harian",
  "Essen Hantam 30 ml Berbagai Varian – Perisa Umpan Galatama, Harian, dan Lomba",
  "Essen Hantam 60 ml Berbagai Varian – Perisa Umpan Galatama, Harian, dan Lomba",
  "STRIKE-X ESSEN 60ML Berbagai Varian – Perisa Umpan untuk Galatama, Harian, dan Lomba",
  "STRIKE-X ESSEN 30 ML Berbagai Varian – Perisa Umpan untuk Galatama, Harian, dan Lomba",
];
// Aksesori sepatu
const PLAIN_SEPATU = [
  "Pembersih Sepatu",
  "Shoes Cleaner 100ml – Pembersih Sepatu Aman untuk Kulit, Suede, Kanvas, Mesh, dan Bahan Sintetis",
];
const VARIANT_SEPATU = ["SHOES CLEANER R-46"];
// Tinju & seni bela diri
const PLAIN_BELADIRI = [
  "Kipas Tai Chi Polos Warna Merah | Kipas Latihan Pernapasan & Olahraga Tradisional",
];

function dimsOf(p: any): [number, number, number] {
  const L = Number(p.lengthCm ?? 0), W = Number(p.widthCm ?? 0), H = Number(p.heightCm ?? 0);
  return L > 0 && W > 0 && H > 0 ? [L, W, H] : [15, 10, 3];
}
function beratOf(p: any): number {
  let w = Number(p.weightGram ?? 0);
  if (!w && p.weightKg != null) w = Math.round(Number(p.weightKg) * 1000);
  return w > 0 ? w : 100;
}

function addPlain(name: string, kat: string) {
  const p = byName(name);
  if (!p) { console.log(`[MISS] ${name}`); return; }
  const stok = Number(p.stock) || 0;
  rows.push(
    buildRow({
      kat,
      nama: String(p.name ?? ""),
      desc: cleanDesc(p.description) || descFallback(kat, String(p.name ?? "")),
      imgs: (p.images as unknown[]) || [],
      berat: beratOf(p),
      dims: dimsOf(p),
      harga: Number(p.price) || 0,
      stok,
    })
  );
  console.log(`[BARU ] ${String(p.name).slice(0, 48)} | stok ${stok} | ${(p.images || []).length} img`);
}

function addVariant(name: string, kat: string) {
  const p = byName(name);
  if (!p) { console.log(`[MISS] ${name}`); return; }
  const vs = Array.isArray(p.variants) && p.variants.length ? p.variants : null;
  if (!vs) { addPlain(name, kat); return; }
  const desc = cleanDesc(p.description) || descFallback(kat, String(p.name ?? ""));
  for (const v of vs) {
    const stok = Number(v.stock) || 0;
    const harga = Number(v.price) || Number(p.price) || 0;
    rows.push(
      buildRow({
        kat,
        nama: String(p.name ?? ""),
        desc,
        imgs: (p.images as unknown[]) || [],
        berat: beratOf(p),
        dims: dimsOf(p),
        harga,
        stok,
        pn1: "Varian",
        pv1: String(v.name ?? "").trim(),
      })
    );
    console.log(`[VAR  ] ${String(p.name).slice(0, 38)} | ${String(v.name).slice(0, 20)} | stok ${stok}`);
  }
}

for (const n of PLAIN_MEMANCING) addPlain(n, CAT_MEMANCING);
for (const n of VARIANT_MEMANCING) addVariant(n, CAT_MEMANCING);
for (const n of PLAIN_SEPATU) addPlain(n, CAT_SEPATU);
for (const n of VARIANT_SEPATU) addVariant(n, CAT_SEPATU);
for (const n of PLAIN_BELADIRI) addPlain(n, CAT_BELADIRI);

if (!rows.length) {
  console.error("Tidak ada baris yang bisa diproses.");
  process.exit(1);
}

// ---- Tulis ke salinan template: bersihkan baris data lama (0-based >= 5) ----
for (const k of Object.keys(ws)) {
  if (k[0] === "!") continue;
  const c = XLSX.utils.decode_cell(k);
  if (c.r >= 5) delete ws[k];
}
XLSX.utils.sheet_add_aoa(ws, rows, { origin: 5 });
for (const sn of wb.SheetNames) fixRef(wb.Sheets[sn]);
XLSX.writeFile(wb, OUT);

// ---- Verifikasi baca ulang ----
const wb2 = XLSX.readFile(OUT);
const t = XLSX.utils.sheet_to_json(wb2.Sheets["Template"], { header: 1, defval: "" });
console.log("\nSignature A1:", JSON.stringify(wb2.Sheets["Template"]["A1"]?.v), "| A2:", JSON.stringify(wb2.Sheets["Template"]["A2"]?.v));
console.log("Baris total Template:", t.length, "| produk ditulis:", rows.length);
let wsrvCount = 0;
for (let r = 5; r < t.length; r++) {
  for (let i = 4; i <= 12; i++) if (String(t[r][i] ?? "").includes("wsrv.nl")) wsrvCount++;
}
console.log("Sisa sel wsrv.nl:", wsrvCount);
const perKat = new Map<string, number>();
for (let r = 5; r < t.length; r++) {
  const k = String(t[r][0] || "?");
  perKat.set(k, (perKat.get(k) || 0) + 1);
}
console.log("Per kategori:");
for (const [k, n] of perKat) console.log(`  ${n}x  ${k}`);
console.log("Output:", OUT);
