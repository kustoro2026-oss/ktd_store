/**
 * Cari produk di anekadropship berdasarkan kata kunci, untuk mengisi baris
 * kosong / memperbaiki file upload TikTok yang gagal.
 * Jalankan: node scripts/find-supplier-product.ts "kata kunci"
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { anekaClient } from "../src/lib/anekadropship.ts";

function loadEnv() {
  const p = path.resolve(".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
}

const q = process.argv[2] ?? "";
if (!q) {
  console.log("Pemakaian: node scripts/find-supplier-product.ts \"kata kunci\"");
  process.exit(1);
}

async function main() {
  loadEnv();
  for (const page of [1, 2]) {
    try {
      const { products, totalPages } = await anekaClient.getProducts({ search: q, page });
      console.log(`\n=== halaman ${page}/${totalPages} ===`);
      for (const p of products) {
        console.log(`- ${p.id} | ${p.name} | ${p.price} | ${p.categoryName ?? ""}`);
      }
      if (page >= totalPages) break;
    } catch (e) {
      console.error(`Halaman ${page} gagal: ${e instanceof Error ? e.message : e}`);
      break;
    }
  }
}

main();
