// tiktok-solve-captcha.ts — temukan posisi gap pada puzzle captcha Tokopedia
// dengan pencocokan piksel: potongan (PNG 110x110) vs gambar utama (JPEG 552x344).
// Output: dx dalam piksel natural (x target potongan di gambar utama) + kandidat lain.
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function fetchBuf(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const pieceUrl = process.argv[2];
  const mainUrl = process.argv[3];
  if (!pieceUrl || !mainUrl) throw new Error("usage: node script <pieceUrl> <mainUrl>");

  const pieceBuf = await fetchBuf(pieceUrl);
  const mainBuf = await fetchBuf(mainUrl);
  fs.writeFileSync(path.join(OUT, "cap-piece.png"), pieceBuf);
  fs.writeFileSync(path.join(OUT, "cap-main.jpg"), mainBuf);

  // Decode
  const piece = await sharp(pieceBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const main = await sharp(mainBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const PW = piece.info.width, PH = piece.info.height;
  const MW = main.info.width, MH = main.info.height;
  console.log(`piece ${PW}x${PH}, main ${MW}x${MH}`);

  const px = (b: Buffer, w: number, x: number, y: number, ch: number) => b[y * w * ch + x * ch];
  // Band vertikal potongan di gambar utama (dari geometri tampilan: offset 59.125/212 * MH)
  const bandTop = Math.round((59.125 / 212) * MH);
  console.log("bandTop =", bandTop, "(tinggi potongan", PH, ")");

  // Resolusi pencarian: gunakan skala 1 (langsung) dengan step 2px untuk cepat
  const step = 2;
  const xMax = MW - PW;
  const yMax = bandTop + 20 < MH - PH ? bandTop + 20 : MH - PH;
  const yMin = bandTop - 20 > 0 ? bandTop - 20 : 0;

  const results: { x: number; y: number; score: number }[] = [];
  for (let y = yMin; y <= yMax; y += step) {
    for (let x = 0; x <= xMax; x += step) {
      let sum = 0, n = 0, sumSq = 0;
      // sampel setiap 3 px untuk kecepatan
      for (let py = 0; py < PH; py += 3) {
        for (let pxi = 0; pxi < PW; pxi += 3) {
          const a = px(piece.data, PW, pxi, py, 3); // alpha (RGBA, ch=3)
          if (a < 40) continue; // transparan
          const r1 = px(piece.data, PW, pxi, py, 0), g1 = px(piece.data, PW, pxi, py, 1), b1 = px(piece.data, PW, pxi, py, 2);
          const r2 = px(main.data, MW, x + pxi, y + py, 0), g2 = px(main.data, MW, x + pxi, y + py, 1), b2 = px(main.data, MW, x + pxi, y + py, 2);
          const d = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
          sum += d; sumSq += d * d; n++;
        }
      }
      if (n < 500) continue;
      const mean = sum / n;
      const varD = sumSq / n - mean * mean;
      // skor: rata-rata selisih + penalti varians tinggi (gap harus seragam gelap/terang)
      const score = mean + Math.sqrt(varD) * 0.35;
      results.push({ x, y, score });
    }
  }
  results.sort((a, b) => a.score - b.score);
  console.log("Top 10 kandidat:");
  for (const r of results.slice(0, 10)) {
    console.log(`  x=${r.x} y=${r.y} score=${r.score.toFixed(2)}`);
  }
  const best = results[0];
  // Konversi ke piksel display (gambar utama 340 display / 552 natural)
  const targetDispX = (best.x / MW) * 340;
  console.log(`\nBEST: x=${best.x} y=${best.y} -> drag ke display x=${targetDispX.toFixed(1)} (dari kiri gambar)`);
  fs.writeFileSync(path.join(OUT, "cap-solve.json"), JSON.stringify({ best, targetDispX, bandTop, PW, PH, MW, MH }));
}

main().catch((e) => { console.error(e); process.exit(1); });
