// Dump Indonesian tree paths for all used catIds + search English dropdown for candidates
const XLSX = require('xlsx');

// 1. tree paths
const cWb = XLSX.readFile('tiktok-upload/lazada-file2.xlsx');
const cRows = XLSX.utils.sheet_to_json(cWb.Sheets['Category Tree'], { header: 1, defval: '', raw: true });
const used = new Set(['10003382','18399','18394','18392','10003387','18376','62514802','18371','18377','16156','17096','16561','18378','18381','16649','16653','16654','18202','18077','18194','18203','62549203','62470802','18201','10100737','10003015','6332','3628','10003070','5404','3739','18060','18062','15637','62114404','16081','17965','10003461']);
console.log('=== INDONESIAN TREE PATHS ===');
const pathOf = {};
for (const r of cRows) {
  const id = String(r[0]).trim();
  if (!used.has(id)) continue;
  const levels = [];
  for (let k = 1; k <= 7; k++) if (r[k]) levels.push(String(r[k]));
  pathOf[id] = levels.join(' > ');
  console.log(id + ' | ' + levels.join(' > '));
}

// 2. English dropdown
const tWb = XLSX.readFile('tiktok-upload/lazada-file1.xlsx');
const h = XLSX.utils.sheet_to_json(tWb.Sheets['template_hide'], { header: 1, defval: '', raw: true });
const dd = [];
for (let i = 6; i < h.length; i++) {
  const v = String(h[i][2] || '').trim();
  if (v) dd.push(v);
}
console.log('\ndropdown entries: ' + dd.length);

// 3. candidate searches per catId
const searches = {
  '18399': ['Purpose Cleaner', 'Multi-Purpose', 'Multipurpose', 'Multi Cleaner', 'All-Purpose'],
  '18394': ['Drain', 'Sink'],
  '18392': ['Bleach', 'Disinfect'],
  '10003387': ['Floor Cleaner', 'Floor Cleaners'],
  '62514802': ['Capsule', 'Pods', 'Laundry Sheet'],
  '16156': ['Odor', 'Smell'],
  '17096': ['Floor', 'Coating'],
  '16561': ['Sealant', 'Adhesive', 'Caulk'],
  '18378': ['Bait', 'Trap'],
  '18381': ['Insecticide', 'Pest Repellent', 'Repellent'],
  '16649': ['Fertilizer', 'Soil'],
  '16653': ['Seed', 'Bulb'],
  '16654': ['Weed', 'Herbicide', 'Pest Control'],
  '18202': ['Herbal'],
  '18077': ['Analgesic', 'Pain Relief'],
  '18194': ['Foot'],
  '18203': ['Nutrition', 'Nutritious'],
  '62549203': ['Itch'],
  '62470802': ['OTC', 'Medicine'],
  '18201': ['Slimming', 'Weight Loss'],
  '10100737': ['Moisturizer', 'Moisturiser'],
  '10003015': ['Enhancer', 'Body'],
  '6332': ['Aging', 'Anti-Aging'],
  '3628': ['Lotion', 'Body Cream'],
  '10003070': ['Bar Soap', 'Soap'],
  '3739': ['Deodorant'],
  '18060': ['Perfume', 'Fragrance'],
  '18062': ['Unisex'],
  '15637': ['Fishing'],
  '62114404': ['Vitamin'],
  '16081': ['Snack', 'Treat'],
  '17965': ['Muslim', 'Islamic'],
  '10003461': ['Date', 'Kurma'],
};
console.log('\n=== DROPDOWN MATCHES PER CATID ===');
for (const [id, kws] of Object.entries(searches)) {
  console.log('\n[' + id + '] ' + (pathOf[id] || '?'));
  const hits = new Set();
  for (const kw of kws) {
    for (const d of dd) {
      if (d.toLowerCase().includes(kw.toLowerCase())) hits.add(d);
    }
  }
  [...hits].slice(0, 12).forEach(x => console.log('   ' + x));
}
