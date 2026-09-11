// tiktok-capsolve4.ts — solver generik: pieceUrl mainUrl offsetYDisplay
// 1) scan kasar step 2 full-width dengan metrik korelasi (piece-main) vs kecerahan piece
// 2) refine step 1 di sekitar best
// Output: drag display px
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const [pieceUrl, mainUrl, offsetYStr] = process.argv.slice(2);
  if (!pieceUrl || !mainUrl) throw new Error("usage: <pieceUrl> <mainUrl> <offsetYDisplay>");

  const pieceBuf = Buffer.from(await (await fetch(pieceUrl, { headers: { "user-agent": "Mozilla/5.0" } })).arrayBuffer());
  const mainBuf = Buffer.from(await (await fetch(mainUrl, { headers: { "user-agent": "Mozilla/5.0" } })).arrayBuffer());
  fs.writeFileSync(path.join(OUT, "cap-piece.png"), pieceBuf);
  fs.writeFileSync(path.join(OUT, "cap-main.jpg"), mainBuf);

  const piece = await sharp(pieceBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const main = await sharp(mainBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const PW = piece.info.width, PH = piece.info.height;
  const MW = main.info.width, MH = main.info.height;

  const alpha = new Uint8Array(PW * PH);
  for (let i = 0; i < PW * PH; i++) alpha[i] = piece.data[i * 4 + 3] > 40 ? 1 : 0;
  const pLum = new Float32Array(PW * PH);
  for (let i = 0; i < PW * PH; i++) {
    const o = i * 4;
    pLum[i] = 0.299 * piece.data[o] + 0.587 * piece.data[o + 1] + 0.114 * piece.data[o + 2];
  }
  const mLum = new Float32Array(MW * MH);
  for (let i = 0; i < MW * MH; i++) {
    const o = i * 3;
    mLum[i] = 0.299 * main.data[o] + 0.587 * main.data[o + 1] + 0.114 * main.data[o + 2];
  }

  const scaleMain = 340 / MW;
  const offsetY = parseFloat(offsetYStr);
  const bandTop = Math.round(offsetY / scaleMain);
  console.log(`offsetY display=${offsetY}, scaleMain=${scaleMain.toFixed(4)}, bandTop natural=${bandTop}`);

  const scoreAt = (x: number, y: number, step: number) => {
    // NCC(main, piece) mean-centered di area opaque + k = mean(piece-main)/mean(piece)
    let sp = 0, sm = 0, spp = 0, smm = 0, spm = 0, dsum = 0, lsum = 0, n = 0;
    for (let py = 0; py < PH; py += step) {
      for (let px = 0; px < PW; px += step) {
        const i = py * PW + px;
        if (!alpha[i]) continue;
        const mx = x + px, my = y + py;
        if (mx < 0 || mx >= MW || my < 0 || my >= MH) continue;
        const p = pLum[i], m = mLum[my * MW + mx];
        sp += p; sm += m; spp += p * p; smm += m * m; spm += p * m;
        dsum += p - m; lsum += p; n++;
      }
    }
    if (n < 200) return null;
    const ncc = (n * spm - sp * sm) / (Math.sqrt(n * spp - sp * sp) * Math.sqrt(n * smm - sm * sm) + 1e-6);
    return { corr: ncc, k: dsum / (lsum + 1e-6), n };
  };

  // Scan kasar (rentang penuh)
  let best = { x: 0, y: 0, corr: -2, k: 0 };
  const yMin = 0, yMax = MH - PH;
  for (let y = yMin; y <= yMax; y += 2) {
    for (let x = 0; x <= MW - PW; x += 2) {
      const s = scoreAt(x, y, 2);
      if (s && s.corr > best.corr) best = { x, y, corr: s.corr, k: s.k };
    }
  }
  console.log(`kasar: x=${best.x} y=${best.y} corr=${best.corr.toFixed(3)} k=${best.k.toFixed(2)}`);
  // Refine
  let best2 = best;
  for (let y = best.y - 6; y <= best.y + 6; y++) {
    for (let x = best.x - 6; x <= best.x + 6; x++) {
      const s = scoreAt(x, y, 1);
      if (s && s.corr > best2.corr) best2 = { x, y, corr: s.corr, k: s.k };
    }
  }
  console.log(`refine: x=${best2.x} y=${best2.y} corr=${best2.corr.toFixed(3)} k=${best2.k.toFixed(2)}`);
  const drag = best2.x * scaleMain;
  console.log(`DRAG = ${drag.toFixed(2)} display px`);
  fs.writeFileSync(path.join(OUT, "cap-solve.json"), JSON.stringify({ best: best2, drag, scaleMain, bandTop }));
}

main().catch((e) => { console.error(e); process.exit(1); });
