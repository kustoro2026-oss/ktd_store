/**
 * Perbaiki produk yang gagal di-scrape (price null / ada field error).
 * Refetch detail-nya satu per satu lalu merge kembali ke products.json.
 * Jalankan: node scripts/fix-missing.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as cheerio from "cheerio";
import { anekaClient } from "../src/lib/anekadropship.ts";

const PRODUCTS_FILE = path.resolve("tiktok-export/products.json");
const DELAY_MS = 800;

function loadEnv() {
  const p = path.resolve(".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

/** "Rp 47.000" -> 47000 (number|null) */
function parsePrice(s: string): number | null {
  const m = s.match(/[\d][\d.,]*/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** "7 x 7 x 23 CM" -> { length, width, height } | null */
function parseVolumeDims(s: string): { length: number; width: number; height: number } | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const f = (v: string) => parseFloat(v.replace(",", "."));
  const [length, width, height] = [f(m[1]), f(m[2]), f(m[3])];
  if ([length, width, height].some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return { length, width, height };
}

function htmlToText(html: string): string {
  if (!html) return "";
  const text = cheerio
    .load(html)("body")
    .text()
    .replace(/[\t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return text.slice(0, 2500);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  loadEnv();
  const rows = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8")) as Record<string, unknown>[];
  const bad = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.price == null || r.sku == null || !String(r.sku ?? "").trim() || r.error);

  console.log(`Produk rusak/kosong: ${bad.length}`);
  if (!bad.length) return;

  const rowIdx = new Map(rows.map((r, i) => [String(r.id), i]));
  for (const { r, i } of bad) {
    const id = String(r.id);
    console.log(`Refetch ${id} (${String(r.name).slice(0, 50)})...`);
    try {
      const d = await anekaClient.getProductDetail(id);
      const dims = parseVolumeDims(d.volume);
      const rec: Record<string, unknown> = {
        id: d.id,
        name: d.name || r.name,
        location: r.location,
        category: r.category,
        description: htmlToText(d.descriptionHtml),
        priceText: d.rekomendasiJual,
        price: parsePrice(d.rekomendasiJual),
        modalText: d.hargaModal,
        modal: parsePrice(d.hargaModal),
        stockText: d.stok,
        stock: parseInt((d.stok.match(/\d[\d.,]*/) ?? [""])[0].replace(/\./g, ""), 10) || null,
        soldText: d.terjual,
        sku: d.sku,
        weightText: d.berat,
        weightGram: d.beratGram,
        weightKg: d.beratGram !== null ? +(d.beratGram / 1000).toFixed(3) : null,
        volumeText: d.volume,
        lengthCm: dims?.length ?? null,
        widthCm: dims?.width ?? null,
        heightCm: dims?.height ?? null,
        ekspedisi: d.ekspedisi,
        sistem: d.sistem,
        alamatSeller: d.alamatSeller,
        images: d.images,
        hasVariants: d.hasVariants,
        variants: d.variants,
      };
      delete rec.error;
      rows[i] = rec;
      rowIdx.set(id, i);
      console.log(`  OK: price=${rec.price} sku=${rec.sku} varian=${(d.variants || []).length}`);
    } catch (e) {
      console.error(`  GAGAL: ${e instanceof Error ? e.message : e}`);
    }
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(rows, null, 1));
    await sleep(DELAY_MS);
  }
  console.log("Selesai. products.json diperbarui.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
