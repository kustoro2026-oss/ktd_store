// Deep-dive: template instructions, exact leaf names, mystery image errors
const XLSX = require('xlsx');

// 1. Template instruction rows
const tWb = XLSX.readFile('tiktok-upload/lazada-file1.xlsx');
console.log('=== TEMPLATE SHEETS ===');
console.log(Object.keys(tWb.Sheets));
const tRows = XLSX.utils.sheet_to_json(tWb.Sheets['template'], { header: 1, defval: '', raw: true });
console.log('=== TEMPLATE ROWS 0-4 (instructions) ===');
for (let i = 0; i <= 4; i++) {
  const r = tRows[i] || [];
  console.log('ROW ' + i + ': ' + JSON.stringify(r.map(c => String(c).slice(0, 120))));
}
if (tWb.Sheets['template_hide']) {
  const h = XLSX.utils.sheet_to_json(tWb.Sheets['template_hide'], { header: 1, defval: '', raw: true });
  console.log('=== template_hide rows: ' + h.length + ' ===');
  for (let i = 0; i < Math.min(h.length, 30); i++) {
    console.log('H' + i + ': ' + JSON.stringify((h[i] || []).map(c => String(c).slice(0, 100))));
  }
}
if (tWb.Sheets['global_hide']) {
  const g = XLSX.utils.sheet_to_json(tWb.Sheets['global_hide'], { header: 1, defval: '', raw: true });
  console.log('=== global_hide rows: ' + g.length + ' ===');
  for (let i = 0; i < Math.min(g.length, 20); i++) {
    console.log('G' + i + ': ' + JSON.stringify((g[i] || []).map(c => String(c).slice(0, 100))));
  }
}

// 2. Tree file exact leaf names
const cWb = XLSX.readFile('tiktok-upload/lazada-file2.xlsx');
console.log('\n=== TREE FILE SHEETS ===');
console.log(Object.keys(cWb.Sheets));
// find the sheet with categories
let catSheet = null;
for (const name of Object.keys(cWb.Sheets)) {
  const rows = XLSX.utils.sheet_to_json(cWb.Sheets[name], { header: 1, defval: '', raw: true });
  const r0 = rows[0] || [];
  if (r0.some(c => String(c).toLowerCase().includes('categor'))) { catSheet = name; break; }
}
console.log('catSheet=' + catSheet);
const cRows = XLSX.utils.sheet_to_json(cWb.Sheets[catSheet], { header: 1, defval: '', raw: true });
console.log('cat tree header: ' + JSON.stringify(cRows[0]));
console.log('cat tree total rows: ' + cRows.length);

// build catId -> all rows
const byId = {};
for (let i = 1; i < cRows.length; i++) {
  const r = cRows[i];
  const id = String(r[0]).trim();
  if (!id) continue;
  if (!byId[id]) byId[id] = [];
  byId[id].push(r);
}

const usedCats = [
  ['10003382','Pembersih Toilet'],['18399','Pembersih Multi Fungsi'],['18394','Wastafel & Drainase'],
  ['18371','Deterjen Cair'],['18376','Pembersih Mesin Cuci'],['18377','Deterjen bubuk'],
  ['18378','Umpan & Perangkap Serangga'],['18381','Semprotan Insektisida, Peralatan & Gulungan'],
  ['18392','Pemutih & Desinfektan'],['17096','Perawatan Lantai & Pelapis'],['10003387','Pembersih Lantai'],
  ['62514802','Kapsul, Pods & lembar Laundry'],['16156','Penghilang Kejang & Bau'],['16654','Pembasmi Rumput Liar & Hama'],
  ['5404','Krim Vagina'],['62470802','Obat Bebas Lainnya'],['16649','Tanah & Pupuk'],['3628','Losion & Krim Tubuh'],
  ['62549203','Obat Anti Gatal'],['16561','Perekat, Campuran, & Sealant'],['16081','Snack Kucing'],
  ['18201','Pelangsing'],['18077','Analgesik Topikal'],['10100737','Pelembap Muka'],['10003070','Sabun Batang'],
  ['10003461','Kurma, Buah Ara & Kesemek'],['17965','Baju Muslimin'],['18062','Unisex'],['18060','Wanita'],['3739','Deodoran'],
];
console.log('\n=== CATID EXISTENCE + LEAF NAME MATCH IN TREE ===');
for (const [id, name] of usedCats) {
  const found = byId[id];
  if (!found) { console.log(id + ' | ' + name + ' => NOT FOUND IN TREE'); continue; }
  const leaves = found.filter(r => {
    // leaf = deepest non-empty level
    for (let k = 7; k >= 1; k--) { if (r[k]) return true; }
    return false;
  });
  const leafNames = [...new Set(found.map(r => {
    let leaf = '';
    for (let k = 1; k <= 7; k++) { if (r[k]) leaf = String(r[k]); }
    return leaf;
  }))];
  const match = leafNames.some(l => l === name);
  console.log(id + ' | "' + name + '" | rows=' + found.length + ' | leafNames=' + JSON.stringify(leafNames) + ' | MATCH=' + match);
}

// 3. Mystery image errors full text
const errWb = XLSX.readFile('tiktok-upload/lazada-error-report.xlsx');
const errRows = XLSX.utils.sheet_to_json(errWb.Sheets['template'], { header: 1, defval: '', raw: true });
const errData = errRows.slice(4);
console.log('\n=== FULL ERROR TEXT FOR NON-WEBP IMAGE ROWS ===');
for (const r of errData) {
  const err = String(r[0] || '');
  if (!err || err.includes('Category')) continue;
  if (err.includes('UNSUPPORTED_IMAGE_FORMAT')) continue;
  console.log('SKU=' + r[27] + '\n  ' + err + '\n');
}
