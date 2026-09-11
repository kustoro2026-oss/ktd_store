// tiktok-capcorr.ts — normalized correlation piece vs main untuk menemukan hole
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

  // mask solid (alpha>=128), subsample every 2nd px untuk kecepatan
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
  // mean-subtracted piece
  const psub = maskPts.map((p) => ({ px: p.px, py: p.py, r: p.pr - meanR, g: p.pg - meanG, b: p.pb - meanB }));
  const pnorm = Math.sqrt(psub.reduce((s, p) => s + p.r * p.r + p.g * p.g + p.b * p.b, 0));
  console.log(`mask pts=${n}, pnorm=${pnorm.toFixed(1)}`);

  let best = { H: -1, Y: -1, corr: -1 };
  const top: { H: number; Y: number; corr: number }[] = [];

  const yCenter = process.argv[2] ? parseInt(process.argv[2], 10) : 62;
  console.log(`yCenter=${yCenter}`);

  for (let Y = yCenter - 4; Y <= yCenter + 6; Y++) {
    for (let H = 320; H <= 505; H++) {
      // mean & norm of main window
      let msR = 0, msG = 0, msB = 0;
      const c = psub.length;
      const mx: number[] = new Array(c), my: number[] = new Array(c);
      for (let i = 0; i < c; i++) {
        const { px, py } = psub[i];
        const o = ((Y + py) * MW + (H + px)) * 3;
        mx[i] = main.data[o]; my[i] = main.data[o + 1];
        msR += mx[i]; msG += my[i]; msB += main.data[o + 2];
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
      if (corr > best.corr) best = { H, Y, corr };
      top.push({ H, Y, corr });
    }
  }
  top.sort((a, b) => b.corr - a.corr);
  console.log("TOP 15:");
  for (const t of top.slice(0, 15)) {
    console.log(`  H=${t.H} Y=${t.Y} corr=${t.corr.toFixed(4)}`);
  }
  const scale = 340 / 552;
  console.log(`\nBEST: piece_left_natural=${best.H} y=${best.Y} corr=${best.corr.toFixed(4)}`);
  console.log(`drag display px = ${(best.H * scale).toFixed(2)}`);
  fs.writeFileSync(path.join(OUT, "cap-corr.json"), JSON.stringify({ ...best, dragPx: best.H * scale, scale }));
}

main().catch((e) => { console.error(e); process.exit(1); });
