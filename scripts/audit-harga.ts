// Audit penuh harga jual: semua produk anekadropship (card + detail) vs
// data statis project (productlist.json, tiktok-export/products.json).
// Output: audit-harga-report.json + ringkasan di console.
//
// Jalankan: npx tsx scripts/audit-harga.ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as cheerio from "cheerio";

// ─── Load .env.local secara manual ─────────────────────────────────────────
for (const line of fs.readFileSync(path.resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) {
    process.env[m[1]] = m[2]
      .replace(/^["']|["']$/g, "")
      .replace(/\\\$/g, "$")
      .trim();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "Rp 70.000" -> 70000 (0 jika kosong/tak terbaca). */
function toNum(s: string): number {
  const d = String(s ?? "").replace(/\D/g, "");
  const n = parseInt(d, 10);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const { anekaClient } = await import("../src/lib/anekadropship.ts");
  await anekaClient.ensureLoggedIn();

  console.log("=== FASE 0: INSPEKSI CARD MENTAH ===");
  {
    // Akses method privat via any (hanya untuk audit).
    const html: string = await (anekaClient as any).doFetch(
      "https://anekadropship.id/user/home?search=&category=&location=all&seller=all&page=1"
    );
    const $ = cheerio.load(html);
    const firstCard = $('a.line-clamp-2[href*="/products/"]').first().closest("div.group");
    const dump = firstCard.html() ?? "(card tidak ditemukan)";
    console.log("HTML card pertama (dipotong):\n" + dump.slice(0, 1500));
    console.log("\nTotal card di halaman 1 (user/home):", $('a.line-clamp-2[href*="/products/"]').length);
    // cek pagination
    const pageLinks = $('nav[aria-label="Pagination Navigation"] a[href*="page="]').map((_, el) => $(el).attr("href")).get();
    console.log("Link pagination:", pageLinks.join(" ") || "-");
  }

  // ─── 1) Kumpulkan SEMUA card dari /user/home (tanpa filter) ──────────────
  console.log("\n=== FASE 1: KUMPULKAN SEMUA CARD ===");
  const cards = new Map<string, { name: string; rekomendasiJual: string; hargaModal: string; hargaModalCut: string; location: string }>();
  let page = 1;
  while (true) {
    const { products, totalPages } = await anekaClient.getProducts({ page });
    for (const p of products) {
      if (!cards.has(p.id)) {
        cards.set(p.id, {
          name: p.name,
          rekomendasiJual: p.rekomendasiJual,
          hargaModal: p.hargaModal,
          hargaModalCut: p.hargaModalCut,
          location: p.location,
        });
      }
    }
    console.log(`  halaman ${page}: ${products.length} produk (total unik: ${cards.size}, totalPages=${totalPages})`);
    if (page >= totalPages) break;
    page++;
    await sleep(600);
  }
  console.log(`Total produk unik: ${cards.size}`);

  // ─── 2) Detail tiap produk: Harga Jual + varian ──────────────────────────
  console.log("\n=== FASE 2: DETAIL SEMUA PRODUK ===");
  const details: Record<string, { jual: string; modal: string; jualNum: number; modalNum: number; variants: { name: string; price: string }[] }> = {};
  let done = 0;
  const ids = [...cards.keys()];
  for (const id of ids) {
    try {
      const d = await anekaClient.getProductDetail(id);
      details[id] = {
        jual: d.rekomendasiJual,
        modal: d.hargaModal,
        jualNum: toNum(d.rekomendasiJual),
        modalNum: toNum(d.hargaModal),
        variants: d.variants.slice(0, 5).map((v) => ({ name: v.name, price: v.price })),
      };
    } catch (e) {
      details[id] = { jual: "", modal: "", jualNum: 0, modalNum: 0, variants: [] };
    }
    done++;
    if (done % 25 === 0 || done === ids.length) {
      console.log(`  detail ${done}/${ids.length}...`);
      fs.writeFileSync(path.resolve("tiktok-export/audit-harga-progress.json"), JSON.stringify(details, null, 2));
    }
    await sleep(250);
  }

  // ─── 3) Bandingkan card vs detail ────────────────────────────────────────
  console.log("\n=== FASE 3: BANDING CARD VS DETAIL ===");
  const cardVsDetailMismatch: { id: string; name: string; card: string; detail: string }[] = [];
  const detailJualKosong: { id: string; name: string; card: string }[] = [];
  for (const [id, c] of cards) {
    const d = details[id];
    if (!d) continue;
    if (!d.jual) {
      detailJualKosong.push({ id, name: c.name, card: c.rekomendasiJual });
      continue;
    }
    if (toNum(c.rekomendasiJual) && d.jualNum && toNum(c.rekomendasiJual) !== d.jualNum) {
      cardVsDetailMismatch.push({ id, name: c.name, card: c.rekomendasiJual, detail: d.jual });
    }
  }
  console.log(`Card vs detail HARGA JUAL tidak sama: ${cardVsDetailMismatch.length}`);
  for (const m of cardVsDetailMismatch.slice(0, 30)) {
    console.log(`  [${m.id}] ${m.name.slice(0, 45)} | card=${m.card} detail=${m.detail}`);
  }
  console.log(`Detail HARGA JUAL kosong: ${detailJualKosong.length}`);
  for (const m of detailJualKosong.slice(0, 30)) {
    console.log(`  [${m.id}] ${m.name.slice(0, 45)} | card=${m.card}`);
  }

  // ─── 4) Bandingkan dengan tiktok-export/products.json ────────────────────
  console.log("\n=== FASE 4: BANDING DENGAN products.json (data TikTok) ===");
  const prods = JSON.parse(fs.readFileSync(path.resolve("tiktok-export/products.json"), "utf8")) as any[];
  const byId = new Map(prods.map((p) => [String(p.id), p]));
  const staticMismatch: { id: string; name: string; json: number; live: number }[] = [];
  for (const [id, c] of cards) {
    const s = byId.get(id);
    const live = toNum(c.rekomendasiJual);
    if (!s || !live) continue;
    const old = Number(s.price ?? 0);
    if (old && old !== live) staticMismatch.push({ id, name: c.name, json: old, live });
  }
  console.log(`Harga JSON beda dengan live: ${staticMismatch.length}`);
  for (const m of staticMismatch.slice(0, 40)) {
    console.log(`  [${m.id}] ${m.name.slice(0, 40)}: JSON=${m.json} live=${m.live}`);
  }

  // ─── 5) Bandingkan dengan productlist.json ───────────────────────────────
  console.log("\n=== FASE 5: BANDING DENGAN productlist.json ===");
  const pl = JSON.parse(fs.readFileSync(path.resolve("productlist.json"), "utf8")) as any;
  const plProds: any[] = pl?.products ?? [];
  const plById = new Map(plProds.map((p) => [String(p.id), p]));
  let plMismatch = 0;
  for (const [id, c] of cards) {
    const s = plById.get(id);
    if (!s) continue;
    const live = toNum(c.rekomendasiJual);
    if (live && toNum(s.rekomendasiJual) !== live) {
      plMismatch++;
      console.log(`  [${id}] ${c.name.slice(0, 40)}: pl=${s.rekomendasiJual} live=${c.rekomendasiJual}`);
    }
  }
  console.log(`productlist.json beda harga: ${plMismatch} dari ${plById.size} yang cocok id-nya`);

  // ─── 6) Tulis laporan ────────────────────────────────────────────────────
  const report = { cardVsDetailMismatch, detailJualKosong, staticMismatch };
  fs.writeFileSync(path.resolve("tiktok-export/audit-harga-report.json"), JSON.stringify(report, null, 2));
  console.log("\nLaporan: tiktok-export/audit-harga-report.json");
}

main().catch((e) => {
  console.error("Gagal:", e);
  process.exit(1);
});
