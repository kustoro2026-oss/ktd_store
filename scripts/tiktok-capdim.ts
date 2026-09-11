// tiktok-capdim.ts — scan lubang DIMMED memakai alpha mask piece sbg template
// y fix di sekitar 132 (dari tip_y=66*2), scan semua x step 1
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

  const alpha = new Uint8Array(PW * PH);
  for (let i = 0; i < PW * PH; i++) alpha[i] = piece.data[i * 4 + 3] > 40 ? 1 : 0;
  const mLum = new Float32Array(MW * MH);
  for (let i = 0; i < MW * MH; i++) {
    const o = i * 3;
    mLum[i] = 0.299 * main.data[o] + 0.587 * main.data[o + 1] + 0.114 * main.data[o + 2];
  }

  // border pixels piece
  const border: { px: number; py: number }[] = [];
  for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
    const i = py * PW + px;
    if (!alpha[i]) continue;
    let isB = false;
    for (let dy = -1; dy <= 1 && !isB; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = px + dx, ny = py + dy;
      if (nx < 0 || nx >= PW || ny < 0 || ny >= PH) { isB = true; break; }
      if (!alpha[ny * PW + nx]) { isB = true; break; }
    }
    if (isB) border.push({ px, py });
  }
  console.log(`border px: ${border.length}, piece ${PW}x${PH}, main ${MW}x${MH}`);

  type Cand = { x: number; y: number; dim: number; edge: number; stdIn: number };
  const cands: Cand[] = [];

  for (let y = 118; y <= 150; y++) {
    for (let x = 0; x <= MW - PW; x++) {
      let s = 0, s2 = 0, n = 0, so = 0, no = 0;
      for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
        const v = mLum[(y + py) * MW + (x + px)];
        if (alpha[py * PW + px]) { s += v; s2 += v * v; n++; }
        else { so += v; no++; }
      }
      const meanIn = n > 0 ? s / n : 0;
      const stdIn = n > 0 ? Math.sqrt(Math.max(0, s2 / n - meanIn * meanIn)) : 999;
      const meanOut = no > 0 ? so / no : 0;
      // kontras tepi: beda dalam-luar di border
      let es = 0, en = 0;
      for (const { px, py } of border) {
        const inL = mLum[(y + py) * MW + (x + px)];
        let outs = 0, on = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || nx >= PW || ny < 0 || ny >= PH || alpha[ny * PW + nx]) continue;
          const mx = x + nx, my = y + ny;
          if (mx < 0 || mx >= MW || my < 0 || my >= MH) continue;
          outs += mLum[my * MW + mx]; on++;
        }
        if (on > 0) { es += Math.abs(inL - outs / on); en++; }
      }
      const dim = meanOut - meanIn;
      const edge = en > 0 ? es / en : 0;
      cands.push({ x, y, dim, edge, stdIn });
    }
  }

  const byDim = [...cands].sort((a, b) => b.dim - a.dim);
  console.log("\nTop 15 by dim (meanOut - meanIn):");
  for (const c of byDim.slice(0, 15)) console.log(`  x=${c.x} y=${c.y} dim=${c.dim.toFixed(2)} edge=${c.edge.toFixed(2)} stdIn=${c.stdIn.toFixed(1)}`);

  const byEdge = [...cands].sort((a, b) => b.edge - a.edge);
  console.log("\nTop 15 by edge:");
  for (const c of byEdge.slice(0, 15)) console.log(`  x=${c.x} y=${c.y} dim=${c.dim.toFixed(2)} edge=${c.edge.toFixed(2)} stdIn=${c.stdIn.toFixed(1)}`);

  // kombinasi: dim>25 && edge>20
  const combo = cands.filter((c) => c.dim > 25 && c.edge > 18).sort((a, b) => (b.dim + b.edge) - (a.dim + a.edge));
  console.log("\nCombo (dim>25 && edge>18), top 15:");
  for (const c of combo.slice(0, 15)) console.log(`  x=${c.x} y=${c.y} dim=${c.dim.toFixed(2)} edge=${c.edge.toFixed(2)} stdIn=${c.stdIn.toFixed(1)}`);

  // sample pixel: kolom x=410 vs x=300 di y=180
  console.log("\nSample (y=180):");
  for (const sx of [100, 200, 300, 380, 400, 410, 420, 430, 440, 460, 480, 500, 520]) {
    const o = (180 * MW + sx) * 3;
    const lum = 0.299 * main.data[o] + 0.587 * main.data[o + 1] + 0.114 * main.data[o + 2];
    console.log(`  x=${sx} R=${main.data[o]} G=${main.data[o + 1]} B=${main.data[o + 2]} L=${lum.toFixed(0)}`);
  }
  console.log("\nSample (y=150):");
  for (const sx of [380, 400, 410, 420, 430, 440, 450, 460, 470, 480, 500, 520]) {
    const o = (150 * MW + sx) * 3;
    const lum = 0.299 * main.data[o] + 0.587 * main.data[o + 1] + 0.114 * main.data[o + 2];
    console.log(`  x=${sx} R=${main.data[o]} G=${main.data[o + 1]} B=${main.data[o + 2]} L=${lum.toFixed(0)}`);
  }
  fs.writeFileSync(path.join(OUT, "cap-dimscan.json"), JSON.stringify({ byDim: byDim.slice(0, 15), byEdge: byEdge.slice(0, 15), combo: combo.slice(0, 15) }));
}

main().catch((e) => { console.error(e); process.exit(1); });
