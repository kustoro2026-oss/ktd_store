// Indonesian Memancing subtree + English Interior Vehicle Care subtree
const XLSX = require('xlsx');
const cWb = XLSX.readFile('tiktok-upload/lazada-file2.xlsx');
const cRows = XLSX.utils.sheet_to_json(cWb.Sheets['Category Tree'], { header: 1, defval: '', raw: true });
console.log('=== ID tree: rows containing "Memancing" in path ===');
for (const r of cRows) {
  const levels = [];
  for (let k = 1; k <= 7; k++) if (r[k]) levels.push(String(r[k]));
  const path = levels.join(' > ');
  if (path.includes('Memancing')) console.log('   ' + r[0] + ' | ' + path);
}

const tWb = XLSX.readFile('tiktok-upload/lazada-file1.xlsx');
const h = XLSX.utils.sheet_to_json(tWb.Sheets['template_hide'], { header: 1, defval: '', raw: true });
const dd = [];
for (let i = 6; i < h.length; i++) {
  const v = String(h[i][2] || '').trim();
  if (v) dd.push(v);
}
console.log('\n=== English Interior Vehicle Care subtree ===');
dd.filter(d => d.startsWith('Automotive,Cars,Car Care Equipment,Interior Vehicle Care')).forEach(x => console.log('   ' + x));
console.log('\n=== English Car Care Equipment subtree ===');
dd.filter(d => d.startsWith('Automotive,Cars,Car Care Equipment')).forEach(x => console.log('   ' + x));
console.log('\n=== English Pest Control subtree ===');
dd.filter(d => d.startsWith('Household Supplies,Pest Control')).forEach(x => console.log('   ' + x));
