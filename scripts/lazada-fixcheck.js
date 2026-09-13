// Analyze error report vs submitted file to diagnose CAT failures
const XLSX = require('xlsx');
const fs = require('fs');

const errWb = XLSX.readFile('tiktok-upload/lazada-error-report.xlsx');
const errRows = XLSX.utils.sheet_to_json(errWb.Sheets['template'], { header: 1, defval: '', raw: true });
// error report: first sheet data starts at row index 4 (same as template)
const errData = errRows.slice(4);

const subWb = XLSX.readFile('tiktok-upload/lazada-bulk-cengkareng.xlsx');
const subRows = XLSX.utils.sheet_to_json(subWb.Sheets['template'], { header: 1, defval: '', raw: true });
const subData = subRows.slice(4);

// submitted: [0]=GroupNo,[1]=catId,[2]=Kategori,[3]=Nama,[4]=NamaEN,[5..12]=Foto1-8,[13]=Merek,[14]=Desc,[15]=Bahan,[16]=VarName1,[17]=VarOpt1,[18]=VarImg1,[19]=VarName2,[20]=VarOpt2,[21..23]=dims,[24]=berat,[25]=Harga,[26]=SellerSKU,[27]=Gudang
// error report: [0]=Keterangan Error, then [1]=GroupNo,[2]=catId,[3]=Kategori,...  [27]=SellerSKU,[28]=Gudang

console.log('=== ERROR REPORT ROWS WITH CATEGORY ERROR ===');
let catFail = 0, imgFail = 0, other = 0;
for (const r of errData) {
  const err = String(r[0] || '');
  if (!err) continue;
  if (err.includes('Category value is invalid')) {
    catFail++;
    const sku = r[27];
    console.log(JSON.stringify({
      sku, err: err.slice(0, 60),
      group: r[1], catId: r[2], kategori: r[3], brand: r[14],
      var1: r[17], var2: r[19], imgs: [r[6], r[7]].map(x => String(x).slice(0, 70)),
    }));
  } else if (err.toLowerCase().includes('image') || err.toLowerCase().includes('cdn') || err.toLowerCase().includes('main image') || err.toLowerCase().includes('media')) {
    imgFail++;
  } else {
    other++;
    const sku = r[27];
    console.log('OTHER ERR SKU=' + sku + ' ERR=' + err.slice(0, 200));
  }
}
console.log('catFail=' + catFail + ' imgFail=' + imgFail + ' other=' + other);

console.log('\n=== SUBMITTED ROWS FOR CAT-FAIL SKUs ===');
const catFailSkus = new Set();
for (const r of errData) {
  const err = String(r[0] || '');
  if (err.includes('Category value is invalid')) catFailSkus.add(String(r[27]));
}
for (const r of subData) {
  const sku = String(r[26] || '');
  if (catFailSkus.has(sku)) {
    console.log(JSON.stringify({
      sku, group: r[0], catId: r[1], kategori: r[2], name: String(r[3]).slice(0, 40),
      brand: r[13], var1: r[16] + '|' + r[17], var2: r[19] + '|' + r[20],
      nImgs: [r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12]].filter(Boolean).length,
      gudang: r[27], harga: r[25],
    }));
  }
}

// check products.json for variants of cat-fail SKUs
const products = JSON.parse(fs.readFileSync('tiktok-export/products.json', 'utf8'));
const byId = new Map(products.map(p => [String(p.id), p]));
console.log('\n=== VARIANTS IN SOURCE FOR CAT-FAIL SKUs ===');
for (const sku of [...catFailSkus].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
  const id = sku.replace('KTDCGK-', '');
  const p = byId.get(id);
  if (!p) { console.log(sku + ' NOT FOUND in products.json'); continue; }
  console.log(sku + ' | cat=' + p.category + ' | hasVariants=' + p.hasVariants + ' | nVariants=' + (p.variants ? p.variants.length : 0) + ' | nImgs=' + (p.images ? p.images.length : 0));
}

// check image-error rows with non-webp codes
console.log('\n=== IMAGE-ERROR DETAILS (first image url suffix + code) ===');
for (const r of errData) {
  const err = String(r[0] || '');
  if (!err || err.includes('Category')) continue;
  const m = err.match(/thirdErrorMessage\s+(\S+)-(\S+)/);
  const code = m ? m[2] : (err.match(/thirdErrorCode\s+(\d+)/) || [])[1] || '';
  const sku = r[27];
  const imgs = [r[6], r[7], r[8], r[9], r[10], r[11], r[12], r[13]].filter(Boolean);
  const exts = imgs.map(u => String(u).split('?')[0].slice(-8));
  console.log(sku + ' | code=' + code + ' | nImg=' + imgs.length + ' | exts=' + exts.join(','));
}
