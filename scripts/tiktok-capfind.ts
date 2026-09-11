// tiktok-capfind.ts — gabungan corr + ratio untuk menemukan hole, H range lebar
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
  console.log(`piece ${PW}x${PH}, main ${MW}x${MH}`);

  // mask solid (alpha>=128), subsample /2
  const maskPts: { px: number; py: number; pr: number; pg: number; pb: number }[] = [];
  let sumR = 0, sumG = 0, sumB = 0;
  for (let py = 0; py < PH; py++) {
    for (let px = 0; px < PW; px++) {
      const o = (py * PW + px) * 4;
      if (piece.data[o + 3] >= 128 && ((px + py) % 2 === 0)) {
        maskPts.push({ px, py, pr: piece.data[o], pg: piece.data[o + 1], pb: piece.data[o + 2] });
        sumR += piece.data[o]; sumG += piece.data[o + 1]; sumB += piece.data[o + 2];
      }
    }
  }
  const n = maskPts.length;
  const meanR = sumR / n, meanG = sumG / n, meanB = sumB / n;
  const psub = maskPts.map((p) => ({ px: p.px, py: p.py, r: p.pr - meanR, g: p.pg - meanG, b: p.pb - meanB }));
  const pnorm = Math.sqrt(psub.reduce((s, p) => s + p.r * p.r + p.g * p.g + p.b * p.b, 0));
  // piece mean luminance
  const pLum = (meanR * 0.299 + meanG * 0.587 + meanB * 0.114) / 255;
  console.log(`mask pts=${n}, pnorm=${pnorm.toFixed(1)}, piece meanLum=${pLum.toFixed(3)}`);

  const H0 = 240, H1 = 470, Y0 = 112, Y1 = 140;
  const results: { H: number; Y: number; corr: number; ratio: number; cv: number }[] = [];

  for (let Y = Y0; Y <= Y1; Y++) {
    for (let H = H0; H <= H1; H++) {
      if (Y + PH > MH || H + PW > MW) continue;
      let msR = 0, msG = 0, msB = 0;
      const c = psub.length;
      const lumR: number[] = new Array(c);
      for (let i = 0; i < c; i++) {
        const { px, py } = psub[i];
        const o = ((Y + py) * MW + (H + px)) * 3;
        msR += main.data[o]; msG += main.data[o + 1]; msB += main.data[o + 2];
        lumR[i] = (0.299 * main.data[o] + 0.587 * main.data[o + 1] + 0.114 * main.data[o + 2]) / 255;
      }
      const mR = msR / c, mG = msG / c, mB = msB / c;
      let dot = 0, mnorm = 0;
      for (let i = 0; i < c; i++) {
        const { px, py, r, g, b } = psub[i];
        const o = ((Y + py) * MW + (H + px)) * 3;
        const dr = main.data[o] - mR, dg = main.data[o + 1] - mG, db = main.data[o + 2] - mB;
        dot += dr * r + dg * g + db * b;
        mnorm += dr * dr + dg * dg + db * db;
      }
      const corr = dot / (Math.sqrt(mnorm) * pnorm);
      // ratio main/piece per point (luminance), cv = std/mean
      let rsum = 0, rsum2 = 0;
      for (let i = 0; i < c; i++) rsum += lumR[i];
      const rmean = rsum / c;
      for (let i = 0; i < c; i++) rsum2 += (lumR[i] - rmean) * (lumR[i] - rmean);
      const rstd = Math.sqrt(rsum2 / c);
      const cv = rmean > 0 ? rstd / rmean : 9;
      const ratio = rmean / pLum;
      results.push({ H, Y, corr, ratio, cv });
    }
  }

  const byCorr = [...results].sort((a, b) => b.corr - a.corr).slice(0, 15);
  console.log("\nTOP by corr:");
  for (const t of byCorr) console.log(`  H=${t.H} Y=${t.Y} corr=${t.corr.toFixed(4)} ratio=${t.ratio.toFixed(3)} cv=${t.cv.toFixed(3)}`);

  const byCv = [...results].filter((t) => t.ratio >= 0.25 && t.ratio <= 1.15).sort((a, b) => a.cv - b.cv).slice(0, 15);
  console.log("\nTOP by cv (ratio 0.25..1.15):");
  for (const t of byCv) console.log(`  H=${t.H} Y=${t.Y} cv=${t.cv.toFixed(4)} ratio=${t.ratio.toFixed(3)} corr=${t.corr.toFixed(4)}`);

  // candidates spesifik
  console.log("\nSpecific candidates:");
  for (const [H, Y] of [[256, 126], [260, 126], [262, 126], [264, 126], [268, 126], [262, 122], [346, 122], [350, 122], [262, 130]]) {
    const r = results.find((t) => t.H === H && t.Y === Y);
    if (r) console.log(`  (H=${H},Y=${Y}) corr=${r.corr.toFixed(4)} ratio=${r.ratio.toFixed(3)} cv=${r.cv.toFixed(3)}`);
  }

  // neighborhood grid sekitar kandidat utama
  console.log("\nNeighborhood (rows Y=124..131, cols H=258..266):");
  const gridY = [124, 125, 126, 127, 128, 129, 130, 131];
  const gridH = [258, 259, 260, 261, 262, 263, 264, 265, 266];
  let header = "   Y\\H";
  for (const H of gridH) header += `  ${H} `;
  console.log(header);
  for (const Y of gridY) {
    let line = `  ${Y}  `;
    for (const H of gridH) {
      const r = results.find((t) => t.H === H && t.Y === Y);
      line += r ? r.corr.toFixed(3) + " " : "----- ";
    }
    console.log(line);
  }

  const scale = 340 / 552;
  const best = byCv[0];
  if (best) {
    console.log(`\nBEST-cv: piece_left=${best.H} y=${best.Y} cv=${best.cv.toFixed(4)} ratio=${best.ratio.toFixed(3)} corr=${best.corr.toFixed(4)}`);
    console.log(`drag display px = ${(best.H * scale).toFixed(2)}`);
    fs.writeFileSync(path.join(OUT, "cap-find.json"), JSON.stringify({ best, byCorr: byCorr.slice(0, 5), byCv: byCv.slice(0, 5), scale }));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
