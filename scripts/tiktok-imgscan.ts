/**
 * tiktok-imgscan.ts — Scan ketersediaan semua URL gambar produk top-100.
 * - HEAD tiap URL unik (concurrency 20)
 * - lapor: URL mati, produk tanpa gambar, jumlah webp
 * Jalankan: node scripts/tiktok-imgscan.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

const root = process.cwd();
const top: any[] = JSON.parse(
  fs.readFileSync(path.join(root, "tiktok-export", "top100.json"), "utf8")
);

const unique = new Set<string>();
let webpCount = 0;
let noImg = 0;
const imgCounts: number[] = [];
for (const p of top) {
  const imgs = p.images || [];
  imgCounts.push(imgs.length);
  if (!imgs.length) noImg++;
  for (const u of imgs) {
    unique.add(u);
    if (/\.webp/i.test(u)) webpCount++;
  }
}

const urls = [...unique];
const results: Record<string, string> = {};
let done = 0;
async function run() {
  const q = [...urls];
  const workers = Array.from({ length: 20 }, async () => {
    while (q.length) {
      const u = q.pop()!;
      try {
        const r = await fetch(u, { method: "HEAD", signal: AbortSignal.timeout(15000) });
        results[u] = String(r.status);
      } catch (e: any) {
        results[u] = "ERR " + e.message;
      }
      done++;
      if (done % 100 === 0) console.log("...", done, "/", urls.length);
    }
  });
  await Promise.all(workers);
}
run().then(() => {
  const broken = Object.entries(results).filter(([, s]) => !s.startsWith("200"));
  console.log("=== HASIL ===");
  console.log("produk:", top.length, "| URL unik:", urls.length, "| webp:", webpCount);
  console.log("produk tanpa gambar:", noImg);
  console.log("URL bermasalah:", broken.length);
  for (const [u, s] of broken.slice(0, 40)) console.log(s, u);
  if (broken.length) fs.writeFileSync(path.join(root, "tiktok-export", "img-broken.json"), JSON.stringify(Object.fromEntries(broken), null, 2));
});
