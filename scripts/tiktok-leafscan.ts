/**
 * tiktok-leafscan.ts — Cek SEMUA leaf (439 produk) vs leaf resmi 12 template.
 * Output: daftar leaf_id yang dipakai tapi tidak ada di template resmi.
 * Jalankan: node scripts/tiktok-leafscan.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

const root = process.cwd();
const META: Record<string, { leaves: Record<string, number> }> = JSON.parse(
  fs.readFileSync(path.join(root, "tiktok-export", "templates-meta.json"), "utf8")
);
const catMap: Record<string, { id: string; name: string; leaf: string; leafName: string; sourceCategory: string }> =
  JSON.parse(fs.readFileSync(path.join(root, "tiktok-export", "category-map.json"), "utf8"));

const official: Record<string, string> = {};
for (const m of Object.values(META)) for (const p of Object.keys(m.leaves)) official[m.leaves[p]] = p;

const used: Record<string, { name: string; count: number; products: string[] }> = {};
for (const [id, e] of Object.entries(catMap)) {
  const u = (used[e.leaf] ??= { name: e.leafName, count: 0, products: [] });
  u.count++;
  if (u.products.length < 3) u.products.push(e.name);
}

console.log("=== LEAF DIPAKAI TAPI TIDAK ADA DI TEMPLATE RESMI ===");
let missing = 0;
for (const [id, u] of Object.entries(used)) {
  if (!official[id]) {
    missing++;
    console.log(`MISSING ${id} | ${u.name} | dipakai ${u.count}x | contoh: ${u.products.join(" ;; ")}`);
  }
}
console.log("total missing leaf:", missing);
