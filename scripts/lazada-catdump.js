const XLSX = require('xlsx');
const wb = XLSX.readFile('tiktok-upload/lazada-file2.xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Category Tree'], { header: 1, defval: '' });
const data = rows.slice(1);
const mode = process.argv[2]; // 'kw' or 'subtree'
const arg = process.argv[3] || '';
const seen = new Set();
for (const r of data) {
  const path = [r[1], r[2], r[3], r[4], r[5], r[6], r[7]].filter(Boolean).join(' > ');
  const low = path.toLowerCase();
  let hit = false;
  if (mode === 'subtree') {
    // dump all leaf rows under given L1 (or L1>L2) prefix
    hit = path.toLowerCase().startsWith(arg.toLowerCase());
  } else {
    hit = arg.split(',').filter(Boolean).some(k => low.includes(k.toLowerCase()));
  }
  if (hit) {
    const key = r[0] + '|' + path;
    if (!seen.has(key)) { seen.add(key); console.log(r[0] + ' | ' + path); }
  }
}
