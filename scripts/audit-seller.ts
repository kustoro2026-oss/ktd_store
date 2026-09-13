// Audit: seller mana yang produknya paling banyak (untuk upload Lazada 1 seller).
// Dasar: tiktok-export/products.json (434 produk) — grup per alamatSeller & location.
import * as fs from "node:fs";

const products = JSON.parse(
  fs.readFileSync("tiktok-export/products.json", "utf8")
) as {
  id: string;
  name: string;
  location: string;
  alamatSeller?: string;
  price: number;
  stock?: number;
  hasVariants?: boolean;
}[];

console.log("TOTAL PRODUK:", products.length);

// ── 1) Per alamat seller ──────────────────────────────────────────────────
const byAddr = new Map<string, { n: number; ids: string[]; loc: string }>();
for (const p of products) {
  const addr = (p.alamatSeller ?? "(tanpa alamat)").trim();
  const e = byAddr.get(addr) ?? { n: 0, ids: [], loc: p.location ?? "-" };
  e.n++;
  e.ids.push(p.id);
  byAddr.set(addr, e);
}
console.log("\n== SELLER (alamat unik):", byAddr.size, "==");
const topAddr = [...byAddr.entries()].sort((a, b) => b[1].n - a[1].n);
for (const [addr, e] of topAddr.slice(0, 15)) {
  console.log(`  ${String(e.n).padStart(3)} produk | ${e.loc} | ${addr.slice(0, 60)}`);
}

// ── 2) Per lokasi (kota) ──────────────────────────────────────────────────
const byLoc = new Map<string, number>();
for (const p of products) {
  const loc = (p.location ?? "-").trim();
  byLoc.set(loc, (byLoc.get(loc) ?? 0) + 1);
}
console.log("\n== PER KOTA ==");
for (const [loc, n] of [...byLoc.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)} produk | ${loc}`);
}

// ── 3) Ringkas seller teratas: total harga & produk bervarian ─────────────
const [top] = topAddr;
console.log("\n== SELLER TERATAS ==");
console.log("alamat :", top[0]);
const ids = top[1].ids;
const topProducts = products.filter((p) => ids.includes(p.id));
console.log("jumlah :", topProducts.length);
console.log("varian :", topProducts.filter((p) => p.hasVariants).length);
console.log("range harga:", Math.min(...topProducts.map((p) => p.price)), "-",
  Math.max(...topProducts.map((p) => p.price)));
console.log("sample nama:");
for (const p of topProducts.slice(0, 10)) console.log("  -", p.name.slice(0, 70));
