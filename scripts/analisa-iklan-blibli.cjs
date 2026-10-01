// Analisa produk prioritas iklan Bliklan (Blibli Ads) — KTD Store.
//
// Sumber data:
//  - blibli-upload/blibli-products-raw.json  : 752 listing aktif (productSku, categoryName,
//    minSellingPrice, availableStockLevel2 per pickup point, merchantSku)
//  - blibli-upload/_sku-aneka-map.json       : merchantSku -> { anekaId } (peta dari sesi stock sync)
//  - src/lib/products-cache.json             : katalog aneka (modal, terjual, stok, berat)
//
// Output:
//  - Console: ringkasan + 3 daftar prioritas (mesin untung / laku / habis pakai)
//  - CSV    : blibli-upload/iklan-prioritas.csv (semua baris ter-match)
//
// Pemakaian: node scripts/analisa-iklan-blibli.cjs
//
// Estimasi biaya platform = Reguler Margin + Biaya Layanan Pengiriman
// (sumber: halaman "Biaya Seller di Blibli" + Seller Agreement annex; angka per
// subkategori bervariasi — nilai di bawah ini estimasi konservatif per kelompok).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const load = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

const raw = load("blibli-upload/blibli-products-raw.json");
const skuMap = load("blibli-upload/_sku-aneka-map.json");
const catalog = load("src/lib/products-cache.json").products;
const blibliBuilt = load("blibli-products.json");

const byAnekaId = new Map(catalog.map((p) => [String(p.id), p]));
const urlBySku = new Map(blibliBuilt.map((p) => [p.id, p.url]));

// Fallback matching via nama — replika logika src/lib/blibli-product-links.ts
// (normalize + cocok persis + prefix min. 2 kata), dipakai bila merchantSku
// tidak ada di _sku-aneka-map.json.
function normalize(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
const byName = new Map();
for (const p of catalog) {
  const k = normalize(p.name);
  if (k && !byName.has(k)) byName.set(k, p);
}
const NAME_KEYS = [...byName.keys()];
function findByBlibliName(name) {
  const key = normalize(name);
  if (!key) return null;
  const exact = byName.get(key);
  if (exact) return exact;
  for (const k of NAME_KEYS) {
    if (k.startsWith(key + " ") && key.split(" ").length >= 2) return byName.get(k);
    if (key.startsWith(k + " ") && k.split(" ").length >= 2) return byName.get(k);
  }
  return null;
}

// ── Parsing helpers ──────────────────────────────────────────────────────────
function toRp(s) {
  if (typeof s === "number") return s;
  const first = String(s || "").split("/")[0];
  const n = first.replace(/[^0-9]/g, "");
  return n ? parseInt(n, 10) : 0;
}

function parseTerjual(t) {
  if (!t) return 0;
  const s = String(t).toLowerCase().trim();
  const mult = /rb|ribu/.test(s) ? 1000 : 1;
  let num = s.replace(/[^0-9.,]/g, "");
  if (!num) return 0;
  if (num.includes(",")) num = num.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}$/.test(num)) num = num.replace(/\./g, "");
  const v = parseFloat(num);
  return isNaN(v) ? 0 : Math.round(v * mult);
}

// ── Estimasi biaya platform per kategori Blibli (margin% + pengiriman%) ─────
// shipPct di-cap Rp 30.000/item. Nilai = estimasi konservatif.
const CAT_FEE = [
  [/Charger/i, 8.0, 1.0, "Aksesoris Handphone"],
  [/Wireless In Ear|Wireless Over Ear|Speaker|CCTV|Retro Game|Boneka Elektronik|Bohlam|Kipas|Penerangan|Baterai/i, 5.75, 2.5, "Elektronik"],
  [/Suplemen|Jamu|Vitamin|Obat|Collagen|Probiotik|Pereda Nyeri|Koyo|Perban|Madu|Kurma|Cuka|Susu|Minuman|Sereal|Biji|Perasa|Penyedap|Kopi|Jus|Makanan|Cemilan/i, 7.5, 3.5, "Kesehatan/Bliblimart"],
  [/Hewan|Kucing|Ikan/i, 7.5, 3.5, "Hewan Peliharaan"],
  [/Mobil|Motor|Kendaraan|Pelumas|Bodi|Perkakas Mesin/i, 8.0, 2.5, "Otomotif"],
  [/Memancing/i, 8.0, 3.5, "Hobby & Interest"],
  [/Tanaman|Taman/i, 8.0, 3.5, "Peralatan Taman"],
  [/Pembersih|Deterjen|Pengharum|Pembasmi|Insektisida|Penanggulangan|Kamper|Foam|Laundry|Kebersihan/i, 8.0, 3.5, "Perawatan Rumah Tangga"],
  [/Sandal|Sneakers|Sepatu|Boots|Flats|Heels|Slip On|Baju|Kemeja|Blouse|Kaos|Sarung|Batik|Formal|Kaftan|Dress|Celana|Outer|Tas|Tote|Clutch|Ransel|Selempang|Tidur|Perhiasan|Cincin|Gantungan Kunci|Aksesoris/i, 8.0, 3.5, "Fashion"],
  [/Serum|Sabun|Toner|Tabir|Anti-Aging|Skin|Body|Deodoran|Perawatan|Shampoo|Hair|Gels|Sisir|Cukur|Perangkat Kecantikan|Foot/i, 8.0, 3.5, "Kesehatan & Kecantikan"],
  [/Sprei|Perlengkapan|Peralatan|Perkakas|Bahan Bangunan|Permainan|Mainan/i, 8.0, 3.5, "Home & Living"],
];

function feeFor(categoryName) {
  for (const [re, margin, ship, label] of CAT_FEE) {
    if (re.test(categoryName)) return { margin, ship, label };
  }
  return { margin: 8.0, ship: 3.5, label: "Default" };
}

// ── Hitung baris ─────────────────────────────────────────────────────────────
const rows = [];
let unmatched = 0;

for (const it of raw.active) {
  const merchantSku = it.itemPickupPointSummary?.merchantSku;
  const entry = merchantSku ? skuMap[merchantSku] : null;
  let prod = entry ? byAnekaId.get(String(entry.anekaId)) : null;
  if (!prod) prod = findByBlibliName(it.productName);
  if (!prod) {
    unmatched++;
    continue;
  }

  const price = it.minSellingPrice || toRp(prod.rekomendasiJual);
  const modal = toRp(prod.hargaModal);
  if (!price || !modal || modal >= price) continue;

  const fee = feeFor(it.categoryName || "");
  const shipFee = Math.min((price * fee.ship) / 100, 30000);
  const feeTotal = (price * fee.margin) / 100 + shipFee;
  const untung = price - modal;
  const untungBersih = Math.round(untung - feeTotal);
  const terjual = parseTerjual(prod.terjual);
  const stok = parseInt(String(prod.stok || "0").replace(/[^0-9]/g, ""), 10) || 0;
  const stokPP = it.availableStockLevel2 || 0;

  rows.push({
    sku: it.productSku,
    anekaId: prod.id,
    nama: it.productName,
    kategori: it.categoryName,
    feeLabel: fee.label,
    harga: price,
    modal,
    untung,
    fee: Math.round(feeTotal),
    untungBersih,
    persen: Math.round((untungBersih / price) * 100),
    terjual,
    stok,
    stokPP,
    berat: prod.beratGram || 0,
    url: urlBySku.get(it.productSku) || "",
  });
}

rows.sort((a, b) => b.untungBersih - a.untungBersih);

// ── CSV ──────────────────────────────────────────────────────────────────────
const csv = [
  "sku;anekaId;nama;kategori;feeLabel;harga;modal;untung;feeEst;untungBersih;persen;terjual;stokAneka;stokBlibliPP;beratGram",
  ...rows.map((r) =>
    [
      r.sku, r.anekaId, `"${String(r.nama).replace(/"/g, "'")}"`, r.kategori, r.feeLabel,
      r.harga, r.modal, r.untung, r.fee, r.untungBersih, r.persen, r.terjual, r.stok, r.stokPP, r.berat,
    ].join(";")
  ),
].join("\n");
fs.writeFileSync(path.join(ROOT, "blibli-upload", "iklan-prioritas.csv"), csv, "utf8");

// ── Ringkasan console ────────────────────────────────────────────────────────
const fmt = (n) => n.toLocaleString("id-ID");
console.log(`Listing aktif: ${raw.active.length} | ter-match ke aneka: ${rows.length} | tak ter-match: ${unmatched}`);
console.log(`CSV: blibli-upload/iklan-prioritas.csv\n`);

const table = (list, title) => {
  console.log(`=== ${title} ===`);
  for (const r of list) {
    console.log(
      `${r.sku} | ${fmt(r.harga).padStart(8)} | untungBersih ${fmt(r.untungBersih).padStart(7)} (${String(r.persen).padStart(2)}%) | terjual ${String(r.terjual).padStart(6)} | stok ${String(r.stok).padStart(5)} | ${r.kategori} | ${String(r.nama).slice(0, 60)}`
    );
  }
  console.log("");
};

table(
  rows.filter((r) => r.untungBersih >= 30000 && r.terjual >= 20).slice(0, 25),
  "A. MESIN UNTUNG — untungBersih >= Rp30rb & terjual >= 20 (urut untung)"
);

table(
  [...rows.filter((r) => r.terjual >= 300 && r.untungBersih >= 10000)].sort((a, b) => b.terjual - a.terjual).slice(0, 25),
  "B. LAKU KERAS — terjual >= 300 & untungBersih >= Rp10rb (urut TERJUAL desc)"
);

table(
  rows.filter((r) => r.untungBersih >= 25000 && r.terjual >= 50 && r.stok >= 150).slice(0, 25),
  "A2. SHORTLIST AKSI — untungBersih >= Rp25rb, terjual >= 50, stok aneka >= 150 (urut untung)"
);

table(
  rows
    .filter((r) => r.untungBersih >= 10000 && r.stok >= 200 && /Pembersih|Deterjen|Suplemen|Jamu|Obat|Vitamin|Pupuk|Tanaman|Pembasmi|Madu|Makanan|Cemilan|Hewan|Kucing|Ikan/i.test(r.kategori))
    .slice(0, 20),
  "C. HABIS PAKAI / REPEAT — konsumabel stok >= 200 (urut untung)"
);

// Statistik fee per label (untuk dokumentasi)
const feeAgg = {};
for (const r of rows) {
  const k = r.feeLabel;
  feeAgg[k] = feeAgg[k] || { n: 0, sumPct: 0 };
  feeAgg[k].n++;
  feeAgg[k].sumPct += (r.fee / r.harga) * 100;
}
console.log("=== Rata-rata total fee platform per kelompok kategori (estimasi) ===");
for (const [k, v] of Object.entries(feeAgg).sort((a, b) => b[1].n - a[1].n)) {
  console.log(`${String(k).padEnd(26)} n=${String(v.n).padStart(3)}  ~${(v.sumPct / v.n).toFixed(2)}%`);
}
