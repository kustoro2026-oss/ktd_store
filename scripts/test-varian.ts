/**
 * Tes parsing varian produk tertentu lewat AnekaClient (login).
 * Jalankan: node scripts/test-varian.ts 1542
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { anekaClient } from "../src/lib/anekadropship.ts";

function loadEnv() {
  const p = path.resolve(".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

async function main() {
  loadEnv();
  const ids = process.argv.slice(2);
  for (const id of ids) {
    const d = await anekaClient.getProductDetail(id);
    console.log("---", id, d.name.slice(0, 50));
    console.log("hasVariants:", d.hasVariants, "| jumlah:", d.variants.length);
    for (const v of d.variants.slice(0, 5)) {
      console.log("  ", JSON.stringify(v));
    }
    if (d.variants.length > 5) console.log("  ... (+", d.variants.length - 5, ")");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
