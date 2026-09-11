// tiktok-capratio.ts — cari hole via keseragaman rasio main/piece (hole = k*piece)
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

  // interior mask: alpha>=128, eroded 4px dari tepi silhouette (hindari outline putih & feather)
  const al = (px: number, py: number) => piece.data[(py * PW + px) * 4 + 3];
  const pts: { px: number; py: number }[] = [];
  for (let py = 0; py < PH; py++) {
    for (let px = 0; px < PW; px++) {
      if (al(px, py) < 128) continue;
      let ok = true;
      for (let dy = -4; dy <= 4 && ok; dy++) for (let dx = -4; dx <= 4 && ok; dx++) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || nx >= PW || ny < 0 || ny >= PH || al(nx, ny) < 128) ok = false;
      }
      if (ok && ((px + py) % 2 === 0)) pts.push({ px, py });
    }
  }
  const n = pts.length;
  console.log(`interior pts=${n}`);

  // hole top natural = 2 * drag_pos.y (argument), cari Y di sekitar itu
  const yCenter = process.argv[2] ? parseInt(process.argv[2], 10) : 62;
  console.log(`yCenter=${yCenter}`);

  let best = { H: -1, Y: -1, cv: Infinity, mean: 0 };
  const results: { H: number; Y: number; cv: number; mean: number }[] = [];

  for (let Y = yCenter - 4; Y <= yCenter + 6; Y++) {
    for (let H = 320; H <= 460; H++) {
      // cek bounds
      let inb = true;
      for (const { px, py } of pts) {
        const x = H + px, y = Y + py;
        if (x < 0 || x >= MW || y < 0 || y >= MH) { inb = false; break; }
      }
      if (!inb) continue;
      // rasio luminance per pixel
      let s = 0, s2 = 0, cnt = 0;
      for (const { px, py } of pts) {
        const mo = ((Y + py) * MW + (H + px)) * 3;
        const po = (py * PW + px) * 4;
        const mL = 0.299 * main.data[mo] + 0.587 * main.data[mo + 1] + 0.114 * main.data[mo + 2];
        const pL = 0.299 * piece.data[po] + 0.587 * piece.data[po + 1] + 0.114 * piece.data[po + 2];
        if (pL < 10) continue;
        const r = mL / pL;
        s += r; s2 += r * r; cnt++;
      }
      if (cnt < 200) continue;
      const mean = s / cnt;
      const cv = Math.sqrt(Math.max(0, s2 / cnt - mean * mean)) / mean;
      results.push({ H, Y, cv, mean });
      if (cv < best.cv) best = { H, Y, cv, mean };
    }
  }
  results.sort((a, b) => a.cv - b.cv);
  console.log("TOP 20 (cv terkecil):");
  for (const r of results.slice(0, 20)) {
    console.log(`  H=${r.H} Y=${r.Y} cv=${r.cv.toFixed(4)} meanRatio=${r.mean.toFixed(3)}`);
  }
  const scale = 340 / 552;
  console.log(`\nBEST: H=${best.H} Y=${best.Y} cv=${best.cv.toFixed(4)} meanRatio=${best.mean.toFixed(3)}`);
  console.log(`drag display px = ${(best.H * scale).toFixed(2)}`);
  fs.writeFileSync(path.join(OUT, "cap-ratio.json"), JSON.stringify({ ...best, dragPx: best.H * scale, scale }));
}

main().catch((e) => { console.error(e); process.exit(1); });
