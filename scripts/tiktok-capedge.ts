// tiktok-capedge.ts — ukur tepi dimming per baris & fit profil piece untuk cari maskX
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const piece = await sharp(fs.readFileSync(path.join(OUT, "cap-piece.png"))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const main = await sharp(fs.readFileSync(path.join(OUT, "cap-main.jpg"))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const PW = piece.info.width, PH = piece.info.height;
  const MW = main.info.width, MH = main.info.height;

  // profil tepi kiri/kanan piece per baris (alpha>40)
  const pL: number[] = [], pR: number[] = [];
  for (let py = 0; py < PH; py++) {
    let L = -1, R = -1;
    for (let px = 0; px < PW; px++) {
      const a = piece.data[(py * PW + px) * 4 + 3];
      if (a > 40) { if (L < 0) L = px; R = px; }
    }
    pL.push(L); pR.push(R);
  }
  console.log("Piece profile (py: L..R):");
  for (let py = 0; py < PH; py++) if (pL[py] >= 0) console.log(`  py=${py}: ${pL[py]}..${pR[py]}`);

  // tepi dimming per baris main (L < 200 dari kiri, dan dari kanan)
  console.log("\nMain dimming edges (y: L R, threshold 200):");
  const mL: number[] = [], mR: number[] = [];
  for (let y = 130; y <= 245; y++) {
    let L = -1, R = -1;
    for (let x = 0; x < MW; x++) {
      const o = (y * MW + x) * 3;
      const lum = 0.299 * main.data[o] + 0.587 * main.data[o + 1] + 0.114 * main.data[o + 2];
      if (lum < 200) { if (L < 0) L = x; R = x; }
    }
    mL.push(L); mR.push(R);
    if (L >= 0) console.log(`  y=${y}: ${L}..${R}`);
  }

  // fit maskX: baris penuh piece (26..49) vs tepi main
  // gunakan baris y=158..181 (offset 26..49)
  let bestX = -1, bestErr = Infinity;
  for (let mx = 380; mx <= 425; mx++) {
    let err = 0, n = 0;
    for (let off = 26; off <= 49; off++) {
      const y = 132 + off;
      if (y < 130 || y > 245) continue;
      const i = y - 130;
      if (mL[i] < 0) continue;
      err += Math.abs(mL[i] - (mx + pL[off])) + Math.abs(mR[i] - (mx + pR[off]));
      n += 2;
    }
    const e = n > 0 ? err / n : Infinity;
    if (e < bestErr) { bestErr = e; bestX = mx; }
  }
  console.log(`\nBest maskX (full rows 26-49): ${bestX}, avgErr=${bestErr.toFixed(2)}`);

  // fit dengan semua baris piece 8..101
  let bestX2 = -1, bestErr2 = Infinity;
  for (let mx = 380; mx <= 425; mx++) {
    let err = 0, n = 0;
    for (let off = 8; off <= 101; off++) {
      const y = 132 + off;
      if (y < 130 || y > 245) continue;
      const i = y - 130;
      if (mL[i] < 0 || pL[off] < 0) continue;
      err += Math.abs(mL[i] - (mx + pL[off])) + Math.abs(mR[i] - (mx + pR[off]));
      n += 2;
    }
    const e = n > 0 ? err / n : Infinity;
    if (e < bestErr2) { bestErr2 = e; bestX2 = mx; }
  }
  console.log(`Best maskX (all rows 8-101): ${bestX2}, avgErr=${bestErr2.toFixed(2)}`);
  console.log(`\n=> drag natural = ${bestX2} (piece left 0 -> hole left), center align = ${bestX2}`);
  console.log(`=> drag display px = ${(bestX2 * (340 / 552)).toFixed(1)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
