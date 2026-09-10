// tiktok-catmap.ts — Map anekadropship source categories + product names
// to TikTok Shop (Tokopedia Seller Center) leaf category IDs.
// Run: node scripts/tiktok-catmap.ts
// Outputs: tiktok-export/category-map.json and tiktok-export/top100.json

import * as fs from "node:fs";
import * as path from "node:path";

const root = process.cwd();
const products: any[] = JSON.parse(
  fs.readFileSync(path.join(root, "tiktok-export", "products.json"), "utf8")
);

// TikTok leaf category: id -> { name, path }
export const LEAVES: Record<string, { name: string; path: string }> = {
  // Pembersih ('' source category)
  "1243792": { name: "Pembersih Toilet", path: "Perlengkapan Rumah Tangga > Perlengkapan Perawatan Rumah > Pembersih Rumah Tangga > Pembersih Toilet" },
  "1244944": { name: "Semprotan, Cairan, dan Tisu Disinfektan", path: "Perlengkapan Rumah Tangga > Perlengkapan Perawatan Rumah > Pembersih Rumah Tangga > Semprotan, Cairan, dan Tisu Disinfektan" },
  "1244816": { name: "Pembuka Saluran", path: "Perlengkapan Rumah Tangga > Perlengkapan Perawatan Rumah > Pembersih Rumah Tangga > Pembuka Saluran" },
  "600458": { name: "Anti Ngengat, Jamur & Lembab", path: "Perlengkapan Rumah Tangga > Perlengkapan Perawatan Rumah > Anti Ngengat, Jamur & Lembab" },
  // Otomotif
  "945288": { name: "Cairan Pembersih & Perawatan", path: "Otomotif & Motor > Pencucian & Perawatan Mobil > Cairan Pembersih & Perawatan" },
  "944904": { name: "Perawatan Interior", path: "Otomotif & Motor > Pencucian & Perawatan Mobil > Perawatan Interior" },
  "945672": { name: "Perawatan Mesin", path: "Otomotif & Motor > Pencucian & Perawatan Mobil > Perawatan Mesin" },
  "945544": { name: "Perawatan Cat", path: "Otomotif & Motor > Pencucian & Perawatan Mobil > Perawatan Cat" },
  "814736": { name: "Sistem Bahan Bakar", path: "Otomotif & Motor > Suku Cadang & Perawatan > Sistem Bahan Bakar" },
  "1003272": { name: "Coolant & Pelumas Sepeda Motor", path: "Otomotif & Motor > Suku Cadang Sepeda Motor > Coolant & Pelumas Sepeda Motor" },
  // Kesehatan
  "700650": { name: "Vitamin, Mineral & Suplemen Kesehatan", path: "Kesehatan > Suplemen Makanan > Vitamin, Mineral & Suplemen Kesehatan" },
  "700649": { name: "Suplemen Kebugaran", path: "Kesehatan > Suplemen Makanan > Suplemen Kebugaran" },
  "950920": { name: "Obat Herbal", path: "Kesehatan > Obat & Pengobatan Alternatif > Obat Herbal" },
  "981512": { name: "Perawatan Rambut/Perawatan Kulit Kepala", path: "Kesehatan > Perawatan Tubuh > Perawatan Rambut/Perawatan Kulit Kepala" },
  // Kecantikan / perawatan
  "1403664": { name: "Losion, Krim, dan Scrub Kaki", path: "Perawatan & Kecantikan > Keperluan Mandi & Perawatan Tubuh > Lotion Tangan, Krim & Scrub > Losion, Krim, dan Scrub Kaki" },
  "601511": { name: "Perawatan Payudara", path: "Perawatan & Kecantikan > Keperluan Mandi & Perawatan Tubuh > Perawatan Payudara" },
  "601492": { name: "Cream & Lotion Tubuh", path: "Perawatan & Kecantikan > Keperluan Mandi & Perawatan Tubuh > Cream & Lotion Tubuh" },
  "601664": { name: "Perangkat Kecantikan Tubuh", path: "Perawatan & Kecantikan > Peralatan Perawatan > Perangkat Kecantikan Tubuh" },
  "601677": { name: "Aksesoris", path: "Perawatan & Kecantikan > Peralatan Perawatan > Aksesoris" },
  "601608": { name: "Toner", path: "Perawatan & Kecantikan > Perawatan Wajah > Toner" },
  "601602": { name: "Facial Sunscreen & Sun Care", path: "Perawatan & Kecantikan > Perawatan Wajah > Facial Sunscreen & Sun Care" },
  "601609": { name: "Pembersih Wajah", path: "Perawatan & Kecantikan > Perawatan Wajah > Pembersih Wajah" },
  "601615": { name: "Moisturiser & Mist", path: "Perawatan & Kecantikan > Perawatan Wajah > Moisturiser & Mist" },
  "601619": { name: "Serum & Essence", path: "Perawatan & Kecantikan > Perawatan Wajah > Serum & Essence" },
  "855824": { name: "Parfum Uniseks", path: "Perawatan & Kecantikan > Wewangian > Parfum Uniseks" },
  "601456": { name: "Penghilang Bau Kaki", path: "Perawatan & Kecantikan > Perawatan Kaki > Penghilang Bau Kaki" },
  // Aksesori sepatu (pengganti 601456 yang TIDAK ada di template resmi)
  "1001480": { name: "Aksesori Sepatu Olahraga", path: "Olahraga & Outdoor > Alas Kaki Olahraga > Aksesori Sepatu Olahraga" },
  // Fashion anak
  "804744": { name: "Gaun", path: "Pakaian Anak > Pakaian Anak Perempuan > Gaun" },
  "804616": { name: "Setelan Resmi & Setelan", path: "Pakaian Anak > Pakaian Anak Perempuan > Setelan Resmi & Setelan" },
  "1202064": { name: "Setelan Anak Laki-Laki", path: "Pakaian Anak > Pakaian Anak Laki-Laki > Setelan Resmi & Setelan > Setelan Anak Laki-Laki" },
  // Hobi
  "603818": { name: "Memancing", path: "Olahraga & Outdoor > Olahraga Air > Memancing" },
  // Elektronik
  "930440": { name: "CCTV", path: "Ponsel & Elektronik > Kamera & Keamanan > CCTV" },
  "601104": { name: "Kipas Angin", path: "Peralatan Rumah Tangga > Peralatan Rumah Tangga > Kipas Angin" },
  "601937": { name: "Kabel, Charger & Adaptor", path: "Ponsel & Elektronik > Aksesori Ponsel > Kabel, Charger & Adaptor" },
  // Makanan & minuman
  "919560": { name: "Cuka", path: "Makanan & Minuman > Bumbu & Bahan Masak > Cuka" },
  "820624": { name: "Susu Bubuk", path: "Makanan & Minuman > Susu & Minuman Susu > Susu Bubuk" },
  "917384": { name: "Minuman Non-Alkohol", path: "Makanan & Minuman > Minuman > Minuman Non-Alkohol" },
  // Tekstil
  "600165": { name: "Seprai & Sarung Bantal", path: "Tekstil & Soft Furnishing > Seprei > Seprai & Sarung Bantal" },
  "600157": { name: "Selimut & Penutup", path: "Tekstil & Soft Furnishing > Seprei > Selimut & Penutup" },
  // Kebun & pertanian
  "980232": { name: "Tanah untuk Berkebun & Pupuk", path: "Renovasi Rumah > Perlengkapan Taman > Tanah untuk Berkebun & Pupuk" },
  "979976": { name: "Benih Bunga & Tanaman", path: "Renovasi Rumah > Perlengkapan Taman > Benih Bunga & Tanaman" },
  "1269776": { name: "Pengendalian Serangga", path: "Renovasi Rumah > Perlengkapan Taman > Pengendalian Hama Komersial dan Industri > Pengendalian Serangga" },
  "1269648": { name: "Pengendalian Tikus Tanah", path: "Renovasi Rumah > Perlengkapan Taman > Pengendalian Hama Komersial dan Industri > Pengendalian Tikus Tanah" },
  "1270160": { name: "Fungisida", path: "Renovasi Rumah > Perlengkapan Taman > Pengendalian Hama Komersial dan Industri > Fungisida" },
  "894088": { name: "Pencahayaan Outdoor", path: "Renovasi Rumah > Lampu & Pencahayaan > Pencahayaan Outdoor" },
  // Peternakan & hewan
  "805264": { name: "Perlengkapan Kesehatan Hewan Ternak", path: "Perlengkapan Hewan Peliharaan > Perlengkapan Perawatan Hewan Ternak & Unggas > Perlengkapan Kesehatan Hewan Ternak" },
  "816136": { name: "Penghilang Bau & Noda", path: "Perlengkapan Hewan Peliharaan > Pasir Anjing & Kucing > Penghilang Bau & Noda" },
  "812680": { name: "Camilan Kucing", path: "Perlengkapan Hewan Peliharaan > Makanan Anjing & Kucing > Camilan Kucing" },
  "1830544": { name: "Kutu Busuk, Kutu, dan Tungau", path: "Perlengkapan Rumah Tangga > Pengendalian Hama Rumah Tangga > Pengendali Serangga Dalam Ruangan > Kutu Busuk, Kutu, dan Tungau" },
  // Perhiasan
  "973064": { name: "Kalung & Liontin Batu Semimulia", path: "Aksesori Perhiasan & Turunannya > Perhiasan Batu > Kalung & Liontin Batu Semimulia" },
  "958984": { name: "Kalung & Liontin Batu Giok", path: "Aksesori Perhiasan & Turunannya > Perhiasan Batu > Kalung & Liontin Batu Giok" },
  "973320": { name: "Gelang & Gelang Kaki Batu Semimulia", path: "Aksesori Perhiasan & Turunannya > Perhiasan Batu > Gelang & Gelang Kaki Batu Semimulia" },
  "971400": { name: "Gelang & Gelang Kaki Batu Giok", path: "Aksesori Perhiasan & Turunannya > Perhiasan Batu > Gelang & Gelang Kaki Batu Giok" },
  "807944": { name: "Perhiasan & Aksesori Kostum Anak-Anak", path: "Pakaian Anak > Aksesori Fashion Anak > Perhiasan & Aksesori Kostum Anak-Anak" },
  // Alat & reparasi
  "888200": { name: "Perekat, Tape & Sealer", path: "Alat & Perangkat Keras > Perekat & Sealant > Perekat, Tape & Sealer" },
  "881544": { name: "Bor Listrik", path: "Alat & Perangkat Keras > Peralatan Listrik > Bor Listrik" },
  // Mainan & game
  "700699": { name: "Boneka Mainan", path: "Mainan & Hobi > Boneka & Boneka Mainan > Boneka Mainan" },
  "913672": { name: "Konsol Game Genggam", path: "Ponsel & Elektronik > Game & Konsol > Konsol Game Genggam" },
  "1033992": { name: "Kabel & Adaptor Konsol", path: "Ponsel & Elektronik > Game & Konsol > Aksesoris Konsol > Kabel & Adaptor Konsol" },
};

type Rule = { match: RegExp; leaf: string };

// ---------------------------------------------------------------------------
// Path resmi dari 12 template Seller Center (tiktok-export/templates-meta.json)
// Leaf 601456 tidak ada di template mana pun -> fallback ke 1001480.
// ---------------------------------------------------------------------------
const META_FILE = path.join(root, "tiktok-export", "templates-meta.json");
const META: Record<string, { leaves: Record<string, number> }> = JSON.parse(
  fs.readFileSync(META_FILE, "utf8")
);

// leaf_id -> { path resmi (separator "/", tanpa top-level), template }
const official: Record<string, { path: string; tpl: string }> = {};
const dupes: string[] = [];
for (const [tpl, m] of Object.entries(META)) {
  for (const [p, id] of Object.entries(m.leaves)) {
    if (official[id]) {
      dupes.push(`leaf ${id} muncul di ${official[id].tpl} dan ${tpl} (${official[id].path})`);
      continue;
    }
    official[id] = { path: p, tpl };
  }
}

// Leaf yang tidak tersedia di template resmi -> pengganti yang valid
const LEAF_FALLBACK: Record<string, string> = {
  "601456": "1001480", // Penghilang Bau Kaki -> Aksesori Sepatu Olahraga (t12)
};

// Format nilai sel Kategori sesuai Example sheet: "path/leaf (id)"
function catValue(id: string): string {
  return `${official[id].path} (${id})`;
}

const RULES: Record<string, Rule[]> = {
  "": [
    { match: /toilet/i, leaf: "1243792" },
    { match: /mampet|sumbat|saluran/i, leaf: "1244816" },
    { match: /interior|mobil/i, leaf: "945288" },
    { match: /mesin cuci|stainless|kerak|pembersih|serbaguna|lantai|kaca|busa/i, leaf: "1244944" },
    { match: /./, leaf: "1244944" },
  ],
  Kesehatan: [
    { match: /kaki/i, leaf: "1403664" },
    { match: /kutu/i, leaf: "981512" },
    { match: /spray/i, leaf: "950920" },
    { match: /./, leaf: "700650" },
  ],
  Fashion: [
    { match: /dress/i, leaf: "804744" },
    { match: /laki/i, leaf: "1202064" },
    { match: /./, leaf: "804616" },
  ],
  Hobi: [{ match: /./, leaf: "603818" }],
  "wewangian atau kosmetik dan perawatan": [
    { match: /toner/i, leaf: "601608" },
    { match: /sunscreen|spf|uv/i, leaf: "601602" },
    { match: /wash|cuci muka/i, leaf: "601609" },
    { match: /serum/i, leaf: "601619" },
    { match: /./, leaf: "601615" },
  ],
  ELEKTRONIK: [
    { match: /cctv/i, leaf: "930440" },
    { match: /kipas/i, leaf: "601104" },
    { match: /./, leaf: "601937" },
  ],
  Otomotif: [
    { match: /stiker|film|kaca/i, leaf: "944904" },
    { match: /engine|mesin/i, leaf: "945672" },
    { match: /fuel|solar|bensin|injector/i, leaf: "814736" },
    { match: /compound|poles|baret|cat/i, leaf: "945544" },
    { match: /gemuk|pelumas|grease/i, leaf: "1003272" },
    { match: /./, leaf: "945288" },
  ],
  "Makanan & Minuman": [
    { match: /cuka/i, leaf: "919560" },
    { match: /susu|soy|kedelai/i, leaf: "820624" },
    { match: /./, leaf: "917384" },
  ],
  "Alat Rumah Tangga": [
    { match: /selimut/i, leaf: "600157" },
    { match: /lem|perekat|sealant|paku|nails|glue/i, leaf: "888200" },
    { match: /lampu|led|bohlam|watt/i, leaf: "893704" },
    { match: /./, leaf: "600165" },
  ],
  Herbal: [{ match: /./, leaf: "950920" }],
  "Pupuk Organik": [{ match: /./, leaf: "980232" }],
  "Pupuk Cair": [{ match: /./, leaf: "980232" }],
  "Benih Tanaman": [{ match: /./, leaf: "979976" }],
  Peternakan: [{ match: /./, leaf: "805264" }],
  Kecantikan: [
    { match: /kaki|tumit|heel/i, leaf: "1403664" },
    { match: /payudara|bust/i, leaf: "601511" },
    { match: /hidung|nose/i, leaf: "601664" },
    { match: /./, leaf: "601492" },
  ],
  "Pembasmi Serangga": [
    { match: /jamur|rayap/i, leaf: "600458" },
    { match: /tungau/i, leaf: "1830544" },
    { match: /tikus|burung|sawah/i, leaf: "1269648" },
    { match: /pestisida|nabati|hama/i, leaf: "1269776" },
    { match: /./, leaf: "600458" },
  ],
  AKSESORIS: [
    { match: /kalung.*giok|giok.*kalung/i, leaf: "958984" },
    { match: /kalung/i, leaf: "973064" },
    { match: /gelang.*giok|giok.*gelang/i, leaf: "971400" },
    { match: /gelang/i, leaf: "973320" },
    { match: /./, leaf: "973320" },
  ],
  Reparasi: [
    { match: /lem|perekat|no more nail/i, leaf: "888200" },
    { match: /bor/i, leaf: "881544" },
    { match: /compound|poles|baret/i, leaf: "945544" },
    { match: /./, leaf: "888200" },
  ],
  "Perawatan Hewan": [
    { match: /litter|bau/i, leaf: "816136" },
    { match: /cat grass|camilan|snack/i, leaf: "812680" },
    { match: /./, leaf: "816136" },
  ],
  "Penghilang Bau Kotoran Hewan": [{ match: /./, leaf: "816136" }],
  Pencahayaan: [{ match: /./, leaf: "894088" }],
  MAINAN: [
    { match: /boneka|plush/i, leaf: "700699" },
    { match: /game|rhythm/i, leaf: "913672" },
    { match: /./, leaf: "700699" },
  ],
  "Parfum Ibadah": [{ match: /./, leaf: "855824" }],
  "Perawatan Sepatu": [{ match: /./, leaf: "601456" }],
  "Desinfektan Rumah dan Kandang": [{ match: /./, leaf: "1244944" }],
  SparePart: [{ match: /./, leaf: "1033992" }],
  "Selimut & Bedong": [{ match: /./, leaf: "600157" }],
};

function mapProduct(p: any): { leaf: string; leafName: string; path: string; tpl: string } {
  const rules = RULES[p.category] || RULES[""];
  if (!rules) throw new Error("no rules for " + p.category);
  for (const r of rules) {
    if (r.match.test(p.name)) {
      const id = LEAF_FALLBACK[r.leaf] ?? r.leaf;
      const off = official[id];
      if (!off) throw new Error(`leaf ${id} tidak ada di template resmi (produk: ${p.name})`);
      const leafName = LEAVES[id]?.name ?? off.path.split("/").pop()!;
      return { leaf: id, leafName, path: off.path, tpl: off.tpl };
    }
  }
  throw new Error("no match for " + p.name);
}

const map: Record<string, any> = {};
const dist: Record<string, number> = {};
const distByLeaf: Record<string, number> = {};
const errors: string[] = [];

for (const p of products) {
  let m;
  try {
    m = mapProduct(p);
  } catch (e: any) {
    errors.push(`${p.id} | ${p.name} | ${p.category} -> ${e.message}`);
    map[p.id] = { id: p.id, name: p.name, sourceCategory: p.category, error: e.message };
    continue;
  }
  map[p.id] = {
    id: p.id,
    name: p.name,
    sourceCategory: p.category,
    leaf: m.leaf,
    leafName: m.leafName,
    path: m.path,
    template: m.tpl,
    categoryCell: catValue(m.leaf),
  };
  dist[p.category] = (dist[p.category] || 0) + 1;
  distByLeaf[m.leafName] = (distByLeaf[m.leafName] || 0) + 1;
}

fs.writeFileSync(
  path.join(root, "tiktok-export", "category-map.json"),
  JSON.stringify(map, null, 2)
);

// Top-100 by stock (hanya produk yang berhasil di-map)
const sorted = [...products].sort((a, b) => (b.stock || 0) - (a.stock || 0));
const top100 = sorted.filter((p) => map[p.id]?.leaf).slice(0, 100);
const top100LeafDist: Record<string, number> = {};
for (const p of top100) {
  const m = map[p.id];
  top100LeafDist[m.leafName] = (top100LeafDist[m.leafName] || 0) + 1;
}
fs.writeFileSync(
  path.join(root, "tiktok-export", "top100.json"),
  JSON.stringify(
    top100.map((p) => ({
      ...p,
      mappedLeaf: map[p.id].leaf,
      mappedLeafName: map[p.id].leafName,
      mappedPath: map[p.id].path,
      mappedTpl: map[p.id].template,
      categoryCell: map[p.id].categoryCell,
    })),
    null,
    2
  )
);

if (dupes.length) {
  console.log("=== PERINGATAN: leaf di >1 template (dipakai yang pertama) ===");
  dupes.forEach((d) => console.log(" ", d));
}
if (errors.length) {
  console.log(`=== PRODUK GAGAL MAP (${errors.length}) — dilaporkan di fill-report ===`);
  errors.forEach((e) => console.log(" ", e));
}
console.log("=== TOTAL LEAF DISTRIBUTION (439) ===");
for (const [k, v] of Object.entries(distByLeaf).sort((a, b) => b[1] - a[1])) console.log(v, k);
console.log("=== TOP-100 (by stock) LEAF DISTRIBUTION ===");
for (const [k, v] of Object.entries(top100LeafDist).sort((a, b) => b[1] - a[1])) console.log(v, k);
const tplDist: Record<string, number> = {};
for (const p of top100) tplDist[map[p.id].template] = (tplDist[map[p.id].template] || 0) + 1;
console.log("=== TOP-100: distribusi template ===");
for (const [k, v] of Object.entries(tplDist).sort((a, b) => b[1] - a[1])) console.log(v, k);
console.log("Distinct leaves total:", Object.keys(distByLeaf).length, "| top100 leaves:", Object.keys(top100LeafDist).length);
console.log("top100 count:", top100.length);
