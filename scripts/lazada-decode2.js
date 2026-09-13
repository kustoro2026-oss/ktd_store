// Decode error report base64 from agent-tools output file
const fs = require('fs');
const path = process.argv[2] || 'C:/Users/exe/.qoder/cache/projects/jakmall-clone-f61c7698/agent-tools/95615d34/87728c2e.txt';
const txt = fs.readFileSync(path, 'utf8');
// find the JSON object
const start = txt.indexOf('{');
const end = txt.lastIndexOf('}');
const json = JSON.parse(txt.slice(start, end + 1));
console.log('status=' + json.status + ' size=' + json.size + ' b64len=' + json.b64.length);
fs.writeFileSync('tiktok-upload/lazada-test-error-report.xlsx', Buffer.from(json.b64, 'base64'));
console.log('written tiktok-upload/lazada-test-error-report.xlsx');

// analyze
const XLSX = require('xlsx');
const wb = XLSX.readFile('tiktok-upload/lazada-test-error-report.xlsx');
console.log('sheets:', Object.keys(wb.Sheets));
const rows = XLSX.utils.sheet_to_json(wb.Sheets['template'], { header: 1, defval: '', raw: true });
console.log('total rows:', rows.length);
const data = rows.slice(4);
for (const r of data) {
  if (!String(r[0] || '')) continue;
  console.log(JSON.stringify({ sku: r[27], err: String(r[0]).slice(0, 120), group: r[1], catId: r[2], kategori: r[3] }));
}
