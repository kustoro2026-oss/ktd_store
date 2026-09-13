// List full subtrees for OTC medicine and Bath & Body; check fishing product names
const XLSX = require('xlsx');
const fs = require('fs');
const tWb = XLSX.readFile('tiktok-upload/lazada-file1.xlsx');
const h = XLSX.utils.sheet_to_json(tWb.Sheets['template_hide'], { header: 1, defval: '', raw: true });
const dd = [];
for (let i = 6; i < h.length; i++) {
  const v = String(h[i][2] || '').trim();
  if (v) dd.push(v);
}
console.log('=== Over The Counter Medicine subtree ===');
dd.filter(d => d.startsWith('Health,Medical Supplies,Over The Counter Medicine')).forEach(x => console.log('   ' + x));
console.log('\n=== Bath & Body subtree (leaf level) ===');
dd.filter(d => d.startsWith('Beauty,Personal Care,Bath & Body')).forEach(x => console.log('   ' + x));
console.log('\n=== Skin Care subtree ===');
dd.filter(d => d.startsWith('Beauty,Skin Care')).forEach(x => console.log('   ' + x));

const products = JSON.parse(fs.readFileSync('tiktok-upload/lazada-cengkareng.json', 'utf8'));
console.log('\n=== Fishing products (2145-2151) ===');
for (const p of products) {
  if (p.id >= 2145 && p.id <= 2151) console.log(p.id + ' | ' + p.name.slice(0, 70));
}
console.log('\n=== 3628 body lotion products (1347) ===');
for (const p of products) {
  if (p.id === 1347) console.log(p.id + ' | ' + p.name.slice(0, 70));
}
console.log('\n=== 62549203 anti gatal products (1336) ===');
for (const p of products) {
  if (p.id === 1336) console.log(p.id + ' | ' + p.name.slice(0, 70));
}
console.log('\n=== 1781/1755/1258/1249 variant products ===');
for (const p of products) {
  if ([1781, 1755, 1258, 1249].includes(p.id)) console.log(p.id + ' | ' + p.name.slice(0, 80));
}
