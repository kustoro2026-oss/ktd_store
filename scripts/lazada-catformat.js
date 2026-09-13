// Investigate the Kategori column expected format from template_hide config + dropdown
const XLSX = require('xlsx');

const tWb = XLSX.readFile('tiktok-upload/lazada-file1.xlsx');
const h = XLSX.utils.sheet_to_json(tWb.Sheets['template_hide'], { header: 1, defval: '', raw: true });

// H4 = JSON configs per column
console.log('=== FULL H4 JSON CONFIGS (col 0-3) ===');
const h4 = h[4] || [];
for (let i = 0; i <= 3; i++) {
  console.log('COL ' + i + ' (' + (h[2] && h[2][i]) + '):');
  console.log(String(h4[i] || '').slice(0, 1500));
  console.log('---');
}

// count dropdown entries: rows from H6 down where col 2 non-empty
let ddCount = 0, ddSample = [], ddIndo = [], ddOurCats = [];
for (let i = 6; i < h.length; i++) {
  const v = String(h[i][2] || '').trim();
  if (!v) continue;
  ddCount++;
  if (ddSample.length < 5) ddSample.push(v);
  if (/Pembersih|Deterjen|Toilet|Wastafel|Drainase|Kapsul|Laundry|Insektisida|Umpan|Rumput|Pemutih|Lantai|Kejang|Obat|Krim|Vagina/i.test(v)) ddOurCats.push(v);
  if (ddIndo.length < 10 && /[a-z]+\s+[a-z]+.*\b(untuk|dan|&|rumah|kucing|cuci|kain)\b/i.test(v)) ddIndo.push(v);
}
console.log('\n=== DROPDOWN (categoryPath) ENTRIES ===');
console.log('ddCount=' + ddCount + ' (H5 said 3088)');
console.log('sample: ' + JSON.stringify(ddSample));
console.log('entries matching our cat names (' + ddOurCats.length + '):');
ddOurCats.slice(0, 40).forEach(v => console.log('  ' + v));

// Check Hasil Proses sheet in file1
const rp = XLSX.utils.sheet_to_json(tWb.Sheets['Hasil  Proses'], { header: 1, defval: '', raw: true });
console.log('\n=== Hasil Proses rows: ' + rp.length + ' ===');
for (let i = 0; i < Math.min(rp.length, 10); i++) {
  console.log('RP' + i + ': ' + JSON.stringify((rp[i] || []).map(c => String(c).slice(0, 80))));
}

// Also check global_hide of file2 (category tree file) for hints
const cWb = XLSX.readFile('tiktok-upload/lazada-file2.xlsx');
const g2 = XLSX.utils.sheet_to_json(cWb.Sheets['global_hide'], { header: 1, defval: '', raw: true });
console.log('\n=== file2 global_hide ===');
for (let i = 0; i < Math.min(g2.length, 10); i++) {
  console.log('G2-' + i + ': ' + JSON.stringify((g2[i] || []).map(c => String(c).slice(0, 120))));
}

// Sample rows from Category Tree to see structure (leaf + full path?)
const cRows = XLSX.utils.sheet_to_json(cWb.Sheets['Category Tree'], { header: 1, defval: '', raw: true });
console.log('\n=== Category Tree sample rows ===');
for (let i = 1; i <= 5; i++) {
  console.log(JSON.stringify(cRows[i].map(c => String(c))));
}
// find our cats in tree and print full path
const targets = ['10003382', '18371', '18381', '5404'];
console.log('\n=== Our cats full path in tree ===');
for (const r of cRows) {
  if (targets.includes(String(r[0]).trim())) {
    console.log(JSON.stringify(r.map(c => String(c))));
  }
}
