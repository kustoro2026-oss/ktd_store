// Check duplicate images across rows + test wsrv.nl on problem URLs
const XLSX = require('xlsx');
const fs = require('fs');

const subWb = XLSX.readFile('tiktok-upload/lazada-bulk-cengkareng.xlsx');
const subRows = XLSX.utils.sheet_to_json(subWb.Sheets['template'], { header: 1, defval: '', raw: true });
const subData = subRows.slice(4);

// images at cols 5..12
const seen = new Map(); // url -> [skus]
let dupCount = 0, rowsWithDup = 0;
for (const r of subData) {
  const sku = String(r[26] || '');
  const imgs = [r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12]].filter(Boolean).map(String);
  let hasDup = false;
  for (const u of imgs) {
    if (seen.has(u)) { seen.get(u).push(sku); dupCount++; hasDup = true; }
    else seen.set(u, [sku]);
  }
  if (hasDup) rowsWithDup++;
}
console.log('total unique imgs=' + seen.size + ' dupCount=' + dupCount + ' rowsWithDup=' + rowsWithDup);
console.log('\n=== URLs used by >1 row ===');
for (const [u, skus] of seen) {
  if (skus.length > 1) console.log(skus.length + 'x | ' + skus.slice(0, 6).join(',') + ' | ' + u.slice(0, 90));
}

// simulate dedup: how many images would each row keep?
console.log('\n=== DEDUP SIMULATION (rows losing all images) ===');
const used = new Set();
let zero = 0;
for (const r of subData) {
  const sku = String(r[26] || '');
  const imgs = [r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12]].filter(Boolean).map(String);
  const keep = [];
  for (const u of imgs) { if (!used.has(u)) { keep.push(u); used.add(u); } }
  if (keep.length === 0) { zero++; console.log('ZERO IMAGES LEFT: ' + sku + ' | had ' + imgs.length + ' imgs | first=' + imgs[0].slice(0, 80)); }
}
console.log('rows with zero unique images: ' + zero);

// test wsrv.nl on problem URLs
const testUrls = [
  'https://anekadropship.id/uploads/products/1766128884_6944fcf426ace.jpg', // 1315 530 error
  'https://anekadropship.id/uploads/products/1786525951_6a7c38ffe2d3e.png', // 1051 small image
  'https://anekadropship.id/uploads/products/1786525951_6a7c38ffe2d3e.png', // same via proxy
  'https://anekadropship.id/uploads/products/1776655835_69e59ddb16236.png', // normal png (1042)
];
(async () => {
  console.log('\n=== wsrv.nl PROXY TESTS ===');
  for (const u of testUrls) {
    const proxied = 'https://wsrv.nl/?url=' + encodeURIComponent(u) + '&output=jpg&w=800&h=800&fit=cover';
    try {
      const res = await fetch(proxied, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
      const buf = await res.arrayBuffer();
      const ct = res.headers.get('content-type');
      // read dims from JPEG SOF
      let dims = '?';
      const b = new Uint8Array(buf);
      if (b[0] === 0xFF && b[1] === 0xD8) {
        let i = 2;
        while (i < b.length) {
          if (b[i] !== 0xFF) { i++; continue; }
          const marker = b[i + 1];
          if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
            const hh = (b[i + 5] << 8) | b[i + 6];
            const ww = (b[i + 7] << 8) | b[i + 8];
            dims = ww + 'x' + hh;
            break;
          }
          i += 2 + ((b[i + 2] << 8) | b[i + 3]);
        }
      }
      console.log(res.status + ' | ' + ct + ' | ' + buf.length + 'B | dims=' + dims + ' | ' + proxied.slice(0, 100));
    } catch (e) {
      console.log('FAIL: ' + u.slice(0, 80) + ' => ' + e.message);
    }
  }
  // also test DIRECT fetch of the 2 problem urls
  console.log('\n=== DIRECT URL TESTS ===');
  for (const u of [testUrls[0], testUrls[1]]) {
    try {
      const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
      const buf = await res.arrayBuffer();
      const b = new Uint8Array(buf);
      let dims = '?', kind = '?';
      if (b[0] === 0xFF && b[1] === 0xD8) { kind = 'JPEG'; let i = 2; while (i < b.length) { if (b[i] !== 0xFF) { i++; continue; } const m = b[i+1]; if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) { dims = ((b[i+7]<<8)|b[i+8]) + 'x' + ((b[i+5]<<8)|b[i+6]); break; } i += 2 + ((b[i+2]<<8)|b[i+3]); } }
      else if (b[0] === 0x89 && b[1] === 0x50) { kind = 'PNG'; dims = ((b[16]<<24)|(b[17]<<16)|(b[18]<<8)|b[19]) + 'x' + ((b[20]<<24)|(b[21]<<16)|(b[22]<<8)|b[23]); }
      console.log(res.status + ' | ' + res.headers.get('content-type') + ' | ' + buf.length + 'B | ' + kind + ' ' + dims + ' | ' + u.slice(0, 80));
    } catch (e) {
      console.log('FAIL: ' + u.slice(0, 80) + ' => ' + e.message);
    }
  }
})();
