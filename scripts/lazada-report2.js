// Analyze lazada-error-report2.xlsx (second upload error report)
const XLSX = require('xlsx');
const wb = XLSX.readFile('tiktok-upload/lazada-error-report2.xlsx');
console.log('sheets:', wb.SheetNames.join(' | '));
for (const sn of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true });
  console.log('\n=== sheet', sn, 'rows:', rows.length);
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const r = rows[i].map(v => String(v).slice(0, 60)).join(' | ');
    console.log(i + ':', r.slice(0, 300));
  }
}
