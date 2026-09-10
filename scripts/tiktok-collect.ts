/**
 * Pengumpul data produk untuk upload TikTok Shop (bulk upload).
 *
 * Jalankan: node scripts/tiktok-collect.ts [--limit N] [--max-pages N]
 *   --limit N      : maksimal N produk (untuk tes). Default: semua.
 *   --max-pages N  : batasi jumlah halaman daftar "terbaru" yang di-scrape.
 *
 * Output (folder tiktok-export/):
 *   - products.json          : data lengkap semua produk (resumable)
 *   - kategori-mapping.csv   : kategori anekadropship unik -> kolom kosong
 *                              "kategori_tiktok" untuk diisi manual
 *   - warehouse-plan.csv     : lokasi seller unik -> nama gudang yang disarankan
 *                              (untuk fitur Multi-Warehouse di Seller Center)
 *
 * Kredensial anekadropship dibaca dari .env.local (ANEKA_EMAIL / ANEKA_PASSWORD).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as cheerio from "cheerio";
import { anekaClient } from "../src/lib/anekadropship.ts";

const OUT_DIR = path.resolve("tiktok-export");
const PRODUCTS_FILE = path.join(OUT_DIR, "products.json");
const DELAY_MS = 700;

// --- util -----------------------------------------------------------------

function loadEnv() {
  const p = path.resolve(".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

function parseArgs(): { limit: number | null; maxPages: number | null; refetch: boolean } {
  const a = process.argv.slice(2);
  const get = (flag: string): string | null => {
    const i = a.indexOf(flag);
    return i >= 0 && a[i + 1] ? a[i + 1] : null;
  };
  const limit = get("--limit");
  const maxPages = get("--max-pages");
  return {
    limit: limit ? parseInt(limit, 10) : null,
    maxPages: maxPages ? parseInt(maxPages, 10) : null,
    refetch: a.includes("--refetch"),
  };
}

/** "Rp 47.000" -> 47000 (number|null) */
function parsePrice(s: string): number | null {
  const m = s.match(/[\d][\d.,]*/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** "7 x 7 x 23 CM" -> { length: 7, width: 7, height: 23 } atau null */
function parseVolumeDims(s: string): { length: number; width: number; height: number } | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const f = (v: string) => parseFloat(v.replace(",", "."));
  const [length, width, height] = [f(m[1]), f(m[2]), f(m[3])];
  if ([length, width, height].some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return { length, width, height };
}

/** HTML deskripsi -> teks polos untuk template TikTok (maks ~2500 char). */
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

function loadExisting(): Map<string, Record<string, unknown>> {
  if (!fs.existsSync(PRODUCTS_FILE)) return new Map();
  try {
    const arr = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8")) as Record<string, unknown>[];
    return new Map(arr.map((r) => [String(r.id), r]));
  } catch {
    return new Map();
  }
}

function save(rows: Record<string, unknown>[]) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(rows, null, 1));
}

// --- main -----------------------------------------------------------------

async function main() {
  loadEnv();
  const { limit, maxPages, refetch } = parseArgs();
  if (!process.env.ANEKA_EMAIL || !process.env.ANEKA_PASSWORD) {
    console.error("ANEKA_EMAIL / ANEKA_PASSWORD tidak ditemukan di .env.local");
    process.exit(1);
  }

  const existing = loadExisting();

  // Mode --refetch: tidak listing ulang (lambat), pakai daftar produk + kategori
  // yang sudah ada di products.json, lalu timpa detailnya dengan varian.
  let unique: { id: string; name: string; location: string }[];
  let catOf = new Map<string, string>();
  if (refetch) {
    unique = [...existing.values()].map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      location: String(r.location ?? ""),
    }));
    for (const r of existing.values()) {
      const c = String(r.category ?? "").trim();
      if (c) catOf.set(String(r.id), c);
    }
    console.log(`Mode refetch: ${unique.length} produk dari products.json`);
  } else {
    // 1) Enumerasi semua produk dari listing utama (user/home, semua kategori).
    //    Loop sampai halaman kosong — paginasi nav upstream hanya menampilkan
    //    jendela kecil jadi totalPages tidak bisa dipercaya.
    console.log("Mengambil daftar produk (listing semua)...");
    const listItems: { id: string; name: string; location: string }[] = [];
    let page = 1;
    while (true) {
      const res = await anekaClient.getProducts({ page });
      if (!res.products.length) break;
      for (const p of res.products) listItems.push({ id: p.id, name: p.name, location: p.location });
      if (maxPages && page >= maxPages) break;
      page++;
      await sleep(400);
      if (page % 5 === 0) console.log(`  halaman ${page} (${listItems.length} produk)...`);
    }
    unique = [...new Map(listItems.map((i) => [i.id, i])).values()];
    console.log(`Total produk unik: ${unique.length}`);

    // 1b) Kategori per produk: halaman kategori anekadropship (filter category=...).
    //     Halaman detail TIDAK menampilkan kategori, jadi diambil dari listing.
    console.log("Memetakan kategori produk...");
    const categories = await anekaClient.getCategories();
    const failedCats: string[] = [];
    for (const c of categories) {
      try {
        let cpage = 1;
        while (true) {
          const res = await anekaClient.getProducts({ category: c.slug, page: cpage });
          if (!res.products.length) break;
          for (const p of res.products) if (!catOf.has(p.id)) catOf.set(p.id, c.slug);
          if (cpage > 30) break; // pengaman
          cpage++;
          await sleep(300);
        }
      } catch {
        failedCats.push(c.slug);
      }
      await sleep(300);
    }
    // Coba sekali lagi kategori yang gagal (error transient).
    for (const slug of failedCats) {
      try {
        let cpage = 1;
        while (true) {
          const res = await anekaClient.getProducts({ category: slug, page: cpage });
          if (!res.products.length) break;
          for (const p of res.products) if (!catOf.has(p.id)) catOf.set(p.id, slug);
          if (cpage > 30) break;
          cpage++;
          await sleep(300);
        }
      } catch {
        console.error(`  kategori tetap gagal: ${slug}`);
      }
      await sleep(300);
    }
    const mapped = unique.filter((u) => catOf.has(u.id)).length;
    console.log(`Produk dengan kategori: ${mapped}/${unique.length} (${categories.length} kategori)`);
  }

  // 2) Detail per produk (resumable; --refetch = timpa semua detail lama).
  const rows = [...existing.values()];
  const rowIdx = new Map(rows.map((r, i) => [String(r.id), i]));
  const doneIds = new Set(rows.map((r) => String(r.id)));
  const todo = limit ? unique.slice(0, limit) : unique;
  let n = 0;
  for (const item of todo) {
    if (!refetch && doneIds.has(item.id)) continue;
    try {
      const d = await anekaClient.getProductDetail(item.id);
      const dims = parseVolumeDims(d.volume);
      const rec: Record<string, unknown> = {
        id: d.id,
        name: d.name || item.name,
        location: item.location,
        category: catOf.get(item.id) ?? "",
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
      // --refetch: timpa baris lama dengan id sama (posisi dipertahankan).
      const idx = rowIdx.get(String(d.id));
      if (idx !== undefined) {
        rows[idx] = rec;
      } else {
        rowIdx.set(String(d.id), rows.length);
        rows.push(rec);
      }
      n++;
    } catch (e) {
      console.error(`  GAGAL produk ${item.id} (${item.name}): ${e instanceof Error ? e.message : e}`);
      const errRec = {
        id: item.id,
        name: item.name,
        location: item.location,
        category: "",
        description: "",
        priceText: "",
        price: null,
        modalText: "",
        modal: null,
        stockText: "",
        stock: null,
        soldText: "",
        sku: "",
        weightText: "",
        weightGram: null,
        weightKg: null,
        volumeText: "",
        lengthCm: null,
        widthCm: null,
        heightCm: null,
        ekspedisi: "",
        sistem: "",
        alamatSeller: "",
        images: [],
        hasVariants: false,
        variants: [],
        error: e instanceof Error ? e.message : "gagal",
      };
      const idx = rowIdx.get(String(item.id));
      if (idx !== undefined) {
        rows[idx] = errRec;
      } else {
        rowIdx.set(String(item.id), rows.length);
        rows.push(errRec);
      }
      n++;
    }
    if (n % 10 === 0) {
      save(rows);
      console.log(`  ${rows.length}/${todo.length} produk tersimpan`);
    }
    await sleep(DELAY_MS);
  }
  save(rows);
  console.log(`Selesai. ${rows.length} produk -> ${PRODUCTS_FILE}`);

  // 3) kategori-mapping.csv
  const catCounts = new Map<string, number>();
  for (const r of rows) {
    const c = String(r.category ?? "").trim();
    if (c) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
  }
  const catCsv = ["kategori_anekadropship;jumlah_produk;kategori_tiktok"];
  for (const [c, count] of [...catCounts.entries()].sort((a, b) => b[1] - a[1])) {
    catCsv.push(`"${c.replace(/"/g, '""')}";${count};`);
  }
  fs.writeFileSync(path.join(OUT_DIR, "kategori-mapping.csv"), catCsv.join("\n"));
  console.log(`Kategori unik: ${catCounts.size} -> kategori-mapping.csv`);

  // Daftar produk yang belum terpetakan kategorinya (untuk isi manual).
  const tanpa = rows.filter((r) => !String(r.category ?? "").trim());
  const tanpaCsv = ["id;nama_produk", ...tanpa.map((r) => `"${r.id}";"${String(r.name).replace(/"/g, '""')}"`)];
  fs.writeFileSync(path.join(OUT_DIR, "tanpa-kategori.csv"), tanpaCsv.join("\n"));
  console.log(`Produk tanpa kategori: ${tanpa.length} -> tanpa-kategori.csv`);

  // 4) warehouse-plan.csv
  const locs = new Map<string, number>();
  for (const r of rows) {
    const l = String(r.location ?? "").trim();
    if (l) locs.set(l, (locs.get(l) ?? 0) + 1);
  }
  const wLines = ["lokasi_seller;jumlah_produk;nama_gudang_yang_disarankan"];
  for (const [l, count] of [...locs.entries()].sort((a, b) => b[1] - a[1])) {
    const name = "Gudang " + l.replace(/\s+/g, " ").trim();
    wLines.push(`"${l.replace(/"/g, '""')}";${count};"${name}"`);
  }
  fs.writeFileSync(path.join(OUT_DIR, "warehouse-plan.csv"), wLines.join("\n"));
  console.log(`Lokasi seller unik: ${locs.size} -> warehouse-plan.csv`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
