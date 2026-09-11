// tiktok-capfullscan.ts — scan SELURUH gambar: kontras tepi bentuk piece (mask bisa di mana saja)
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
  const scale = 340 / MW;

  const alpha = new Uint8Array(PW * PH);
  for (let i = 0; i < PW * PH; i++) alpha[i] = piece.data[i * 4 + 3] > 40 ? 1 : 0;
  const mLum = new Float32Array(MW * MH);
  for (let i = 0; i < MW * MH; i++) {
    const o = i * 3;
    mLum[i] = 0.299 * main.data[o] + 0.587 * main.data[o + 1] + 0.114 * main.data[o + 2];
  }

  // border pixels
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

  type Cand = { x: number; y: number; edge: number; stdIn: number; meanIn: number; meanOut: number };
  const cands: Cand[] = [];

  for (let y = 0; y <= MH - PH; y += 2) {
    for (let x = 0; x <= MW - PW; x += 2) {
      let es = 0, en = 0, s = 0, s2 = 0, n = 0, so = 0, no = 0;
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
      // statistik inside (sampling step 2)
      for (let py = 0; py < PH; py += 2) for (let px = 0; px < PW; px += 2) {
        if (!alpha[py * PW + px]) continue;
        const v = mLum[(y + py) * MW + (x + px)];
        s += v; s2 += v * v; n++;
      }
      for (let py = 0; py < PH; py += 2) for (let px = 0; px < PW; px += 2) {
        const nx = x + px, ny = y + py;
        if (nx < 0 || nx >= MW || ny < 0 || ny >= MH) continue;
        if (alpha[py * PW + px]) continue;
        so += mLum[ny * MW + nx]; no++;
      }
      const edge = en > 0 ? es / en : 0;
      const meanIn = n > 0 ? s / n : 0;
      const stdIn = n > 0 ? Math.sqrt(Math.max(0, s2 / n - meanIn * meanIn)) : 999;
      const meanOut = no > 0 ? so / no : 0;
      cands.push({ x, y, edge, stdIn, meanIn, meanOut });
    }
  }

  const byEdge = [...cands].sort((a, b) => b.edge - a.edge);
  console.log("Top 25 by border contrast (edge):");
  for (const c of byEdge.slice(0, 25)) {
    console.log(`  x=${c.x} y=${c.y} edge=${c.edge.toFixed(2)} stdIn=${c.stdIn.toFixed(1)} meanIn=${c.meanIn.toFixed(1)} meanOut=${c.meanOut.toFixed(1)}`);
  }
  fs.writeFileSync(path.join(OUT, "cap-fullscan.json"), JSON.stringify({ top: byEdge.slice(0, 25), scale }));
}

main().catch((e) => { console.error(e); process.exit(1); });
