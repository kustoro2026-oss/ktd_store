// Check dataValidation on template sheet + search dropdown for Indonesian entries
const XLSX = require('xlsx');
const tWb = XLSX.readFile('tiktok-upload/lazada-file1.xlsx');
const ws = tWb.Sheets['template'];
console.log('=== template !dataValidation ===');
console.log(ws['!dataValidation'] ? JSON.stringify(ws['!dataValidation']).slice(0, 2000) : 'NONE');

const h = XLSX.utils.sheet_to_json(tWb.Sheets['template_hide'], { header: 1, defval: '', raw: true });
// search dropdown entries (col index 2) for Indonesian markers
let indo = 0, eng = 0, samplesIndo = [];
for (let i = 6; i < h.length; i++) {
  const v = String(h[i][2] || '').trim();
  if (!v) continue;
  if (/[Pp]embersih|[Dd]eterjen|[Kk]ecantikan|[Kk]elengkapan|[Oo]bat|[Bb]inatang|[Pp]akaian|[Mm]akanan|[Tt]anah|[Pp]upuk|[Ss]epatu|[Oo]lahraga/.test(v)) { indo++; if (samplesIndo.length < 15) samplesIndo.push(v); }
  else eng++;
}
console.log('indo-like entries: ' + indo + ' | eng-like: ' + eng);
samplesIndo.forEach(s => console.log('  INDO?: ' + s));

// also print entries containing 'Toilet' or 'Kamar'
console.log('\n=== entries with Toilet/Kamar ===');
for (let i = 6; i < h.length; i++) {
  const v = String(h[i][2] || '').trim();
  if (/Toilet|Kamar/i.test(v)) console.log('  ' + v);
}
