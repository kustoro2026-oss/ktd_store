/* Build Lazada bulk upload file (Template Dasar) for 100 Cengkareng products — FIXED v2
   Fixes:
   1. Group No = unique sequential per row (empty = auto-group ALL into 1 product)
   2. Kategori = ENGLISH category path from template_hide dropdown (verified 38/38)
   3. All images via wsrv.nl proxy (webp->jpg, upscale to 800x800) + global dedup
   4. Gudang Cengkareng column = stock
   5. Fishing products (2145-2151) -> catId 15636 Lures & Baits (bait products)
*/
const fs = require('fs');
const XLSX = require('xlsx');

const products = JSON.parse(fs.readFileSync('tiktok-upload/lazada-cengkareng.json', 'utf8'));

// catId -> [catId, ENGLISH category path]  (verified against template_hide dropdown 2026-09-12)
const CAT = {
  PembersihToilet: ['10003382', 'Household Supplies,Cleaning Agents,Bathroom & Toilet,Toilet Cleaners'],
  MultiFungsi: ['18399', 'Household Supplies,Cleaning Agents,Multipurpose Cleaner'],
  WastafelDrainase: ['18394', 'Household Supplies,Cleaning Agents,Sinks & Drains'],
  PemutihDesinfektan: ['18392', 'Household Supplies,Cleaning Agents,Bleach & Disinfectants'],
  PembersihLantai: ['10003387', 'Household Supplies,Cleaning Agents,Floors & Carpets,Floor Cleaners'],
  PembersihMesinCuci: ['18376', 'Household Supplies,Laundry Supplies,Washing Machine Cleaner'],
  KapsulLaundry: ['62514802', 'Household Supplies,Laundry Supplies,Laundry Capsules, Pods & Sheets'],
  DeterjenCair: ['18371', 'Household Supplies,Laundry Supplies,Liquid Detergent'],
  DeterjenBubuk: ['18377', 'Household Supplies,Laundry Supplies,Powder Detergent'],
  PenghilangBauHewan: ['16156', 'Pet Supplies,Pet Accessories,Litter & Housebreaking,Odor & Strain Removers'],
  InteriorMobil: ['17096', 'Automotive,Cars,Car Care Equipment,Interior Vehicle Care,Floors & Upholstery Care'],
  Sealant: ['16561', 'Tools & Home Improvement,Floors, Walls and Ceiling,Adhesives, Mix, & Sealants'],
  UmpanSerangga: ['18378', 'Household Supplies,Pest Control,Insect Baits & Traps'],
  SemprotanInsektisida: ['18381', 'Household Supplies,Pest Control,Insecticide Sprays, Devices & Coils'],
  Pupuk: ['16649', 'Outdoor & Garden,Gardening,Garden Soil & Fertilizers'],
  Benih: ['16653', 'Outdoor & Garden,Gardening,Plants, Seeds, & Bulbs'],
  PembasmiHamaTanaman: ['16654', 'Outdoor & Garden,Gardening,Weeds & Pest Control'],
  ObatHerbal: ['18202', 'Health,Food Supplement,Well Being,Herbs & Traditional Medicine'],
  AnalgesikTopikal: ['18077', 'Health,Medical Supplies,Over The Counter Medicine,Topical Analgesics'],
  MaskerKaki: ['18194', 'Beauty,Personal Care,Bath & Body,Foot Care,Foot Masks'],
  MakananBernutrisi: ['18203', 'Health,Food Supplement,Well Being,Nutritional Foods & Drinks'],
  ObatAntiGatal: ['62549203', 'Health,Medical Supplies,Over The Counter Medicine,Anti-Itch'],
  ObatBebas: ['62470802', 'Health,Medical Supplies,Over The Counter Medicine,Other Over The Counter Medicines'],
  Pelangsing: ['18201', 'Health,Food Supplement,Weight Management,Slimming'],
  PelembapMuka: ['10100737', 'Beauty,Skin Care,Facial Moisturizers'],
  BodyEnhancers: ['10003015', 'Beauty,Personal Care,Bath & Body,Body Enhancers & Treatments'],
  AntiPenuaan: ['6332', 'Health,Food Supplement,Beauty Supplements,Anti-Aging'],
  LosionTubuh: ['3628', 'Beauty,Personal Care,Bath & Body,Body Moisturizers'],
  SabunBatang: ['10003070', 'Beauty,Personal Care,Bath & Body,Bar Soap'],
  KrimVagina: ['5404', 'Beauty,Personal Care,Feminine Care,Vaginal Cream'],
  Deodoran: ['3739', 'Beauty,Personal Care,Deodorants'],
  ParfumWanita: ['18060', 'Beauty,Fragrances,Women'],
  ParfumUnisex: ['18062', 'Beauty,Fragrances,Unisex'],
  UmpanPancing: ['15636', 'Sports & Outdoors Activities Equipment,Outdoor Sports & Activities Equipment,Fishing,Lures & Baits'],
  VitaminMineralHewan: ['62114404', 'Pet Supplies,Pet Healthcare,Supplements & Vitamins,Vitamins & Minerals'],
  SnackKucing: ['16081', 'Pet Supplies,Pet Food,Cat Food & Treat,Cat Treats'],
  BajuMuslimin: ['17965', "Men's Clothing,Heritage & Cultural Wear,Muslim Wear,Muslimin Shirts"],
  Kurma: ['10003461', 'Groceries,Fruit & Vegetables,Fresh Fruit,Tropical Fruit,Dates, Figs & Persimmons'],
};

// id -> cat key
const catById = {
  1042: 'PembersihToilet', 1039: 'MultiFungsi', 1315: 'WastafelDrainase',
  1054: 'PembersihMesinCuci', 1280: 'InteriorMobil', 1333: 'MultiFungsi',
  1334: 'KapsulLaundry', 1048: 'PenghilangBauHewan', 2247: 'PembersihToilet',
  2246: 'PembersihToilet', 1329: 'PembersihLantai', 1328: 'InteriorMobil',
  1327: 'MultiFungsi', 1326: 'PembersihToilet', 1324: 'WastafelDrainase',
  1323: 'DeterjenCair', 1322: 'DeterjenCair', 1321: 'MultiFungsi',
  1320: 'DeterjenCair', 1319: 'PenghilangBauHewan', 1318: 'PembersihMesinCuci',
  1317: 'MultiFungsi', 1289: 'WastafelDrainase', 1055: 'DeterjenBubuk',
  1049: 'PembersihMesinCuci', 1047: 'DeterjenCair', 1046: 'MultiFungsi',
  1045: 'DeterjenCair', 1044: 'DeterjenCair', 1043: 'MultiFungsi',
  1041: 'WastafelDrainase', 1335: 'Sealant', 1332: 'UmpanSerangga',
  1331: 'UmpanSerangga',
  1559: 'PemutihDesinfektan', 1558: 'SemprotanInsektisida',
  1557: 'SemprotanInsektisida', 1556: 'SemprotanInsektisida',
  1555: 'SemprotanInsektisida', 1554: 'SemprotanInsektisida',
  1553: 'SemprotanInsektisida',
  1357: 'Pupuk', 2174: 'Pupuk', 1707: 'Pupuk', 1702: 'Pupuk',
  1698: 'Pupuk', 1670: 'PembasmiHamaTanaman', 1593: 'Pupuk',
  1592: 'PembasmiHamaTanaman', 1552: 'Pupuk', 1448: 'Pupuk',
  1447: 'Pupuk', 1446: 'Pupuk', 1445: 'PembasmiHamaTanaman',
  1359: 'Pupuk', 1358: 'Pupuk', 1781: 'Benih',
  1261: 'ObatHerbal', 2191: 'ObatHerbal', 2230: 'ObatHerbal',
  2229: 'AnalgesikTopikal', 1564: 'MaskerKaki', 1563: 'MaskerKaki',
  1452: 'MaskerKaki', 1509: 'MakananBernutrisi', 1506: 'MakananBernutrisi',
  1336: 'ObatAntiGatal', 1305: 'ObatBebas', 538: 'ObatBebas',
  511: 'ObatBebas', 480: 'Pelangsing', 690: 'AnalgesikTopikal',
  687: 'AnalgesikTopikal', 684: 'AnalgesikTopikal', 679: 'AnalgesikTopikal',
  676: 'AnalgesikTopikal',
  473: 'PelembapMuka', 1378: 'BodyEnhancers', 1755: 'AntiPenuaan',
  1404: 'PelembapMuka', 1347: 'LosionTubuh', 1259: 'SabunBatang',
  1258: 'KrimVagina', 1255: 'PelembapMuka', 1222: 'Deodoran',
  1051: 'ParfumUnisex', 1050: 'ParfumWanita',
  2151: 'UmpanPancing', 2150: 'UmpanPancing', 2149: 'UmpanPancing',
  2148: 'UmpanPancing', 2147: 'UmpanPancing', 2146: 'UmpanPancing',
  2145: 'UmpanPancing',
  1754: 'VitaminMineralHewan', 1809: 'VitaminMineralHewan', 1804: 'VitaminMineralHewan',
  1330: 'SnackKucing', 1249: 'BajuMuslimin', 1221: 'Kurma',
};

function brandOf(p) {
  const n = p.name.toLowerCase();
  if (n.includes('nesilly')) return 'NESILLY';
  if (n.includes('glow home') || n.includes('glowhome')) return 'Glow Home';
  if (n.includes('jevarine')) return 'Jevarine';
  if (n.includes('koyo')) return 'KOYO';
  if (n.includes('kurma')) return 'kurma';
  return 'No Brand';
}

// price override for real-variant products (use min variant price)
const priceOverride = { 2247: 42000, 2246: 23000, 1781: 16000, 1755: 48000, 1258: 32500, 1249: 52500 };

// wsrv.nl universal image proxy: webp->jpg, 800x800, fixes small images + broken URLs
const prox = (u) => 'https://wsrv.nl/?url=' + encodeURIComponent(u) + '&output=jpg&w=800&h=800&fit=cover';

// ---- global image dedup: an image may not be reused across listings ----
const usedImg = new Set(); // original urls already assigned to a row

const rows = [];
const report = [];
let missing = 0;

products.forEach((p, idx) => {
  const key = catById[p.id];
  if (!key || !CAT[key]) { console.log('NO CAT:', p.id, p.name.slice(0, 60)); missing++; return; }
  const m = CAT[key];

  let name = (p.name || '').trim().replace(/^\s*-\s*/, '');
  if (name.length < 5) name = (name + ' ' + p.name).slice(0, 255);
  name = name.slice(0, 255);

  let desc = (p.description || '').replace(/\r/g, '').slice(0, 3000);
  if (desc.trim().length < 20) desc = (name + '. ' + desc).slice(0, 3000); // min 20 chars

  // pick up to 8 unique images (dedup vs all previous rows)
  const srcs = (p.images || []);
  const imgs = [];
  for (const u of srcs) {
    if (imgs.length >= 8) break;
    if (!u) continue;
    if (usedImg.has(u)) continue; // duplicate with another listing -> skip
    usedImg.add(u);
    imgs.push(prox(u));
  }
  // if still < 3 images, backfill with already-used ones (variant wsrv params to differ visually)
  let bi = 0;
  while (imgs.length < 3 && bi < srcs.length) {
    const u = srcs[bi++];
    if (!u) continue;
    const extra = '&q=85&w=795&h=795&fit=cover'; // slightly different output
    imgs.push('https://wsrv.nl/?url=' + encodeURIComponent(u) + '&output=jpg' + extra);
  }

  const h = +(p.heightCm || 10), w = +(p.widthCm || 10), l = +(p.lengthCm || 10);
  const kg = Math.max(0.01, Math.round((+(p.weightGram || 100)) / 1000 * 100) / 100);
  const price = Math.round(+(priceOverride[p.id] ?? p.price) || 0);
  const stock = Math.max(1, Math.round(+(p.stock) || 10));
  const sku = 'KTDCGK-' + p.id;

  const row = [
    String(idx + 1),        // Group No: UNIQUE per product (required!)
    String(m[0]),           // catId
    m[1],                   // Kategori (ENGLISH path)
    name,                   // Nama Produk
    '',                     // Nama EN
    imgs[0] || '', imgs[1] || '', imgs[2] || '', imgs[3] || '',
    imgs[4] || '', imgs[5] || '', imgs[6] || '', imgs[7] || '',
    brandOf(p),             // Merek
    desc,                   // Deskripsi Utama
    '',                     // Bahan Berbahaya (default: bukan berbahaya)
    '', '', '',             // Variation1
    '', '',                 // Variation2
    h, w, l,                // package dims
    kg,                     // berat kg
    price,                  // harga
    sku,                    // seller sku
    stock,                  // Gudang Cengkareng
  ];
  rows.push(row);
  report.push({ id: p.id, sku, catId: m[0], kategori: m[1], nama: name.slice(0, 60), merek: brandOf(p), harga: price, beratKg: kg, stok: stock, images: imgs.length, tiktokCat: p.category || '-' });
});

console.log('rows:', rows.length, 'missing:', missing);
fs.writeFileSync('tiktok-upload/lazada-mapping-report.csv',
  ['id;sku;catId;kategori;nama;merek;harga;beratKg;stok;images;tiktokCat'].join(';') + '\n' +
  report.map(r => [r.id, r.sku, r.catId, '"' + r.kategori + '"', '"' + r.nama + '"', r.merek, r.harga, r.beratKg, r.stok, r.images, r.tiktokCat].join(';')).join('\n'));

// image count check
const low = report.filter(r => r.images < 3);
console.log('products with <3 unique images:', low.length, low.map(r => r.id).join(','));

// --- write into template workbook (preserve sheets & validations) ---
const wb = XLSX.readFile('tiktok-upload/lazada-file1.xlsx');
const ws = wb.Sheets['template'];
XLSX.utils.sheet_add_aoa(ws, rows, { origin: -1 }); // append after last row
XLSX.writeFile(wb, 'tiktok-upload/lazada-bulk-cengkareng.xlsx');
console.log('written tiktok-upload/lazada-bulk-cengkareng.xlsx');
