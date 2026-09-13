// Second round: resolve remaining ambiguous categories
const XLSX = require('xlsx');
const tWb = XLSX.readFile('tiktok-upload/lazada-file1.xlsx');
const h = XLSX.utils.sheet_to_json(tWb.Sheets['template_hide'], { header: 1, defval: '', raw: true });
const dd = [];
for (let i = 6; i < h.length; i++) {
  const v = String(h[i][2] || '').trim();
  if (v) dd.push(v);
}
function search(pats, max = 20) {
  const hits = new Set();
  for (const p of pats) {
    for (const d of dd) {
      if (d.toLowerCase().includes(p.toLowerCase())) hits.add(d);
    }
  }
  [...hits].slice(0, max).forEach(x => console.log('   ' + x));
  console.log('   --- total ' + hits.size + ' hits');
}
console.log('== 3628 Body Lotion: search "Lotions", "Body Lotion" ==');
search(['Body Lotion', 'Lotions', 'Body Creams']);
console.log('\n== 62549203 Anti-Itch: search "Itch", "Rash", "Skin Irritation" ==');
search(['Itch', 'Rash', 'Irritation']);
console.log('\n== 18202 Herbal: search "Traditional Medicine", "Herbal", "Jamu" ==');
search(['Traditional Medicine', 'Herbal', 'Jamu']);
console.log('\n== 18194 Foot Mask: search "Foot Mask", "Foot Peel", "Foot Treatment" ==');
search(['Foot Mask', 'Foot Peel', 'Foot Treatment']);
console.log('\n== 16081 Cat Snack: search "Cat Snack", "Cat Treat", "Cat Food" ==');
search(['Cat Snack', 'Cat Treat', 'Cat Food']);
console.log('\n== 17096 car interior: search "Interior Care", "Car Care", "Auto Care", "Dashboard" ==');
search(['Interior Care', 'Car Care', 'Auto Care', 'Dashboard']);
console.log('\n== 15637 fishing: search "Fishing" (list all) ==');
search(['Fishing'], 30);
console.log('\n== 16156 verify: search "Odor & Strain" ==');
search(['Odor & Strain', 'Strain Remover']);
