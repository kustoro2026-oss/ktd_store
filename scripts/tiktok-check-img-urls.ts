/**
 * Cek semua URL gambar unik di file upload TikTok (FIX) -> pastikan
 * HTTP 200 & bertipe gambar. URL mati = TikTok akan menolak barisnya.
 * Jalankan: node scripts/tiktok-check-img-urls.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSXNS from "xlsx";
const XLSX: any = (XLSXNS as any).default ?? XLSXNS;

const DIR = path.resolve("tiktok-upload");
const files = [
  "t1-Kesehatan-FIX.xlsx",
  "t2-Pakaian Anak-FIX.xlsx",
  "t3-Alat & Perangkat Keras-FIX.xlsx",
  "t8-Perlengkapan Rumah Tangga-FIX.xlsx",
  "t11-Perawatan & Kecantikan-FIX.xlsx",
  "t9-Perlengkapan Hewan Peliharaan-FIX.xlsx",
  "t12-Olahraga & Outdoor-FIX.xlsx",
  "t7-Makanan & Minuman-V2.xlsx",
];

const urls = new Map<string, string[]>(); // url -> [file,baris]

for (const f of files) {
  const wb = XLSX.readFile(path.join(DIR, f));
  const t: any[][] = XLSX.utils.sheet_to_json(wb.Sheets["Template"], { header: 1, defval: "" });
  for (let r = 5; r < t.length; r++) {
    const row = t[r];
    const cells = [...row.slice(4, 13), ...(f.includes("PAKAIAN") ? [row[45]] : [])];
    for (const c of cells) {
      const s = String(c ?? "").trim();
      if (!/^https?:\/\//i.test(s)) continue;
      if (!urls.has(s)) urls.set(s, []);
      urls.get(s)!.push(`${f}#${r + 1}`);
    }
  }
}
console.log(`URL unik: ${urls.size}`);

const bad: string[] = [];
const queue = [...urls.keys()];
let done = 0;
const CONC = 8;

async function check(url: string) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-1023" },
      signal: AbortSignal.timeout(15000),
    });
    done++;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const ok = res.status === 200 || res.status === 206;
    if (!ok || !ct.startsWith("image/")) {
      bad.push(`${res.status} ${ct || "?"}  ${url}  (dipakai ${urls.get(url)!.slice(0, 3).join(", ")})`);
    }
  } catch (e) {
    done++;
    bad.push(`GAGAL ${url}  (${e instanceof Error ? e.message : e})`);
  }
  if (done % 50 === 0) console.log(`  ${done}/${urls.size}`);
}

async function run() {
  let i = 0;
  const workers = Array.from({ length: CONC }, async () => {
    while (i < queue.length) {
      const url = queue[i++];
      await check(url);
    }
  });
  await Promise.all(workers);
  console.log(`\nSelesai. ${done} URL dicek.`);
  if (bad.length) {
    console.log(`URL BERMASALAH: ${bad.length}`);
    bad.forEach((b) => console.log(" ", b));
  } else {
    console.log("SEMUA URL GAMBAR HIDUP (200, image/*).");
  }
}

run();
