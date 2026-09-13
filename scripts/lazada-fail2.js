// Check full error for 4 failed rows + test their image URLs
const XLSX = require('xlsx');
const https = require('https');
const http = require('http');

const wb = XLSX.readFile('tiktok-upload/lazada-error-report2.xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets['template'], { header: 1, defval: '', raw: true });
for (let i = 4; i < rows.length; i++) {
  console.log('=== row', i, 'Group', rows[i][1], 'cat', rows[i][2]);
  console.log('ERR:', String(rows[i][0]).slice(0, 400));
  console.log('NAME:', String(rows[i][4]).slice(0, 80));
}

// test image urls for failed products 1332, 1328, 1305
const products = require('../tiktok-upload/lazada-cengkareng.json');
const prox = (u) => 'https://wsrv.nl/?url=' + encodeURIComponent(u) + '&output=jpg&w=800&h=800&fit=cover';

const test = (url) => new Promise((res) => {
  const mod = url.startsWith('https') ? https : http;
  const req = mod.get(url, (r) => {
    const ct = r.headers['content-type'] || '';
    let size = 0;
    r.on('data', (d) => { size += d.length; });
    r.on('end', () => res(r.statusCode + ' ' + ct + ' ' + size + 'B'));
  });
  req.setTimeout(20000, () => { req.destroy(); res('TIMEOUT'); });
  req.on('error', (e) => res('ERR ' + e.message));
});

(async () => {
  for (const id of [1332, 1328, 1305, 1556]) {
    const p = products.find(x => x.id === id);
    console.log('\n=== product', id, p.name.slice(0, 50));
    for (const u of (p.images || []).slice(0, 5)) {
      const r = await test(prox(u));
      console.log('  ', r, ' <- ', u.slice(0, 80));
    }
  }
})();
