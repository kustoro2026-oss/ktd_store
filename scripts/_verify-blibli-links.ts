// Verifikasi cakupan link Blibli terhadap SELURUH katalog statis
// (src/lib/products-cache.json — nama yang dipakai situs di daftar, detail, keranjang).
// Jalankan: npx --yes tsx scripts/_verify-blibli-links.ts
import { getBlibliProductLink } from "../src/lib/blibli-product-links";
import productsCache from "../src/lib/products-cache.json";
import blibliProducts from "../blibli-products.json";
import * as fs from "fs";
import * as path from "path";

type CatalogProduct = { id: string; name: string };
type BlibliEntry = { id: string; name: string; url: string };

const products = (productsCache as { products: CatalogProduct[] }).products;
const blibli = blibliProducts as BlibliEntry[];

const usedUrls = new Set<string>();
const unmatched: CatalogProduct[] = [];

for (const p of products) {
  const link = getBlibliProductLink(p.name);
  if (link) {
    usedUrls.add(link);
  } else {
    unmatched.push(p);
  }
}

const unusedInBlibli = blibli.filter((b) => !usedUrls.has(b.url));

// URL duplikat di sisi Blibli (indikasi data ganda).
const urlCount = new Map<string, number>();
for (const b of blibli) urlCount.set(b.url, (urlCount.get(b.url) || 0) + 1);
const dupUrls = [...urlCount.entries()].filter(([, n]) => n > 1);

console.log("=== VERIFIKASI LINK BLIBLI ===");
console.log(`Total katalog        : ${products.length}`);
console.log(`Dapat link Blibli    : ${products.length - unmatched.length}`);
console.log(`Tidak dapat link     : ${unmatched.length}`);
console.log(`Entri Blibli terpakai: ${usedUrls.size}/${blibli.length}`);
console.log(`Entri Blibli tak terpakai: ${unusedInBlibli.length}`);
console.log(`URL duplikat di blibli-products.json: ${dupUrls.length}`);

if (dupUrls.length) {
  for (const [u, n] of dupUrls.slice(0, 10)) console.log(`  x${n} ${u}`);
}

console.log("\n--- TIDAK DAPAT LINK (nama katalog) ---");
for (const u of unmatched) console.log(`- [${u.id}] ${u.name}`);

console.log("\n--- ENTRI BLIBLI TAK TERPAKAI ---");
for (const b of unusedInBlibli) console.log(`- [${b.id}] ${b.name}`);

fs.writeFileSync(
  path.join(__dirname, "_blibli-link-check.json"),
  JSON.stringify(
    {
      totalCatalog: products.length,
      matched: products.length - unmatched.length,
      unmatched,
      unusedInBlibli,
      dupUrls: dupUrls.map(([url, n]) => ({ url, n })),
    },
    null,
    2
  )
);
console.log(`\nDetail disimpan: scripts/_blibli-link-check.json`);
