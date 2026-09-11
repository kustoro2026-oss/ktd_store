// tiktok-capsolve3.ts — scan halus 1px: temukan posisi mask gelap
// Metrik: mask = versi gelap potongan -> diff/brighness ≈ konstan (korelasi tinggi
// antara diff dan kecerahan potongan). Cari posisi dengan korelasi maksimum.
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

  const alpha: boolean[] = [];
  for (let i = 0; i < PW * PH; i++) alpha.push(piece.data[i * 4 + 3] > 40);

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

  // Untuk tiap posisi (x,y): korelasi antara (piece - main) dengan pieceLum di area opaque.
  // Mask gelap: piece-main ≈ k*pieceLum -> korelasi tinggi. Area acak: korelasi rendah.
  // Juga hitung rasio k = mean(piece-main)/mean(pieceLum): mask -> k di (0.2..0.8).
  const scan = (x0: number, x1: number, y0: number, y1: number) => {
    const res: { x: number; y: number; corr: number; k: number; n: number }[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let a = 0, b = 0, c = 0, dsum = 0, lsum = 0, n = 0;
        for (let py = 0; py < PH; py++) {
          for (let px = 0; px < PW; px++) {
            const i = py * PW + px;
            if (!alpha[i]) continue;
            const mx = x + px, my = y + py;
            if (mx < 0 || mx >= MW || my < 0 || my >= MH) continue;
            const d = pLum[i] - mLum[my * MW + mx];
            a += d * pLum[i]; b += pLum[i] * pLum[i]; c += d * d;
            dsum += d; lsum += pLum[i]; n++;
          }
        }
        if (n < 5000) continue;
        const corr = a / (Math.sqrt(b) * Math.sqrt(c) + 1e-6);
        const k = dsum / (lsum + 1e-6);
        res.push({ x, y, corr, k, n });
      }
    }
    res.sort((p, q) => q.corr - p.corr);
    return res;
  };

  // Kandidat A: sekitar strip (x 380..400, y 92..112)
  console.log("=== Kandidat strip kanan (x 380..400, y 92..112) ===");
  const A = scan(380, 400, 92, 112);
  for (const r of A.slice(0, 8)) console.log(`  x=${r.x} y=${r.y} corr=${r.corr.toFixed(3)} k=${r.k.toFixed(2)}`);

  // Kandidat B: sekitar x 280..300, y 70..85 (dari NCC v2)
  console.log("=== Kandidat B (x 278..300, y 70..85) ===");
  const B = scan(278, 300, 70, 85);
  for (const r of B.slice(0, 8)) console.log(`  x=${r.x} y=${r.y} corr=${r.corr.toFixed(3)} k=${r.k.toFixed(2)}`);

  const best = A[0];
  const scale = 340 / MW;
  console.log(`\nBEST A: x=${best.x} y=${best.y} corr=${best.corr.toFixed(3)} k=${best.k.toFixed(2)}`);
  console.log(`drag = x * scale = ${best.x} * ${scale.toFixed(4)} = ${(best.x * scale).toFixed(1)} display px`);
  console.log(`best B: x=${B[0].x} y=${B[0].y} corr=${B[0].corr.toFixed(3)} k=${B[0].k.toFixed(2)}`);
  fs.writeFileSync(path.join(OUT, "cap-solve.json"), JSON.stringify({
    bestA: best, bestB: B[0], dragA: best.x * scale, dragB: B[0].x * scale, scale,
  }));
}

main().catch((e) => { console.error(e); process.exit(1); });
