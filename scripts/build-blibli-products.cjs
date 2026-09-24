#!/usr/bin/env node
/**
 * build-blibli-products.cjs
 *
 * Sumber : blibli-upload/blibli-products-raw.json — hasil scrape Seller Center
 *          (API filterProductSkus, 612 produk aktif) via Browser agent.
 * Output : blibli-products.json (root repo) — array {id,name,url,price,stock}
 *          mengikuti pola tokopedia-products.json; dipakai oleh
 *          src/lib/blibli-product-links.ts untuk tombol marketplace Blibli.
 *
 * URL produk memakai format kanonik https://www.blibli.com/p/<slug-nama>/ps--<SKU>
 * (format yang sama dengan link share Blibli dan dikenali aplikasi saat link
 * di-tap dari HP / App Links). Format lama productDetailPageLink (…-KTS.70007.xxxxx.html)
 * hanya bekerja di web — saat di-tap dari HP, aplikasi terbuka tanpa menampilkan produk.
 *
 * Jalankan: node scripts/build-blibli-products.cjs
 */
const fs = require("fs");
const path = require("path");

const RAW = path.join(__dirname, "..", "blibli-upload", "blibli-products-raw.json");
const OUT = path.join(__dirname, "..", "blibli-products.json");

const raw = JSON.parse(fs.readFileSync(RAW, "utf8"));
const active = raw.active || [];

const seen = new Set();
const entries = [];
let skippedNoName = 0;
let skippedNoUrl = 0;
let dupSku = 0;

/** Lowercase, non-alfanumerik jadi "-" — sama dengan cara Blibli membentuk slug URL. */
const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

for (const p of active) {
  const id = String(p.productSku || "").trim();
  const name = String(p.productName || "").trim();
  const slug = slugify(name);
  const url =
    id && slug
      ? `https://www.blibli.com/p/${slug}/ps--${id}`
      : String(p.productDetailPageLink || "").trim();
  if (!name) {
    skippedNoName++;
    continue;
  }
  if (!url) {
    skippedNoUrl++;
    continue;
  }
  if (seen.has(id)) {
    dupSku++;
    continue;
  }
  seen.add(id);
  const price =
    typeof p.minSellingPrice === "number" && p.minSellingPrice > 0
      ? "Rp" + p.minSellingPrice.toLocaleString("id-ID")
      : "";
  entries.push({
    id,
    name,
    url,
    price,
    stock: typeof p.totalStock === "number" ? p.totalStock : null,
  });
}

// Satu baris per entri agar diff-friendly (mengikuti format tokopedia-products.json).
const lines = entries.map((e) => "  " + JSON.stringify(e));
fs.writeFileSync(OUT, "[\n" + lines.join(",\n") + "\n]\n");

console.log(
  `active=${active.length} written=${entries.length} dupSku=${dupSku} noName=${skippedNoName} noUrl=${skippedNoUrl}`
);

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const byNorm = new Map();
for (const e of entries) {
  const k = norm(e.name);
  byNorm.set(k, (byNorm.get(k) || 0) + 1);
}
const dupNames = [...byNorm.entries()].filter(([, n]) => n > 1);
console.log(`nama duplikat (normalized): ${dupNames.length}`);
for (const [k, n] of dupNames.slice(0, 15)) console.log(`  x${n} ${k}`);
