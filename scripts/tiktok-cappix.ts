// tiktok-cappix.ts — periksa pixel mentah & metadata cap-piece.png
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const fp = path.join(OUT, "cap-piece.png");
  const st = fs.statSync(fp);
  console.log(`file: ${fp}`);
  console.log(`size=${st.size}, mtime=${st.mtime.toISOString()}`);

  const img = await sharp(fs.readFileSync(fp)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = img.info.width, H = img.info.height;
  console.log(`dims: ${W}x${H}, channels=${img.info.channels}`);

  // sample beberapa titik
  const pts: [number, number][] = [[5, 5], [10, 10], [30, 30], [55, 40], [60, 60], [100, 30], [50, 90], [105, 105], [2, 50], [90, 90]];
  for (const [x, y] of pts) {
    const o = (y * W + x) * 4;
    console.log(`(${x},${y}) R=${img.data[o]} G=${img.data[o + 1]} B=${img.data[o + 2]} A=${img.data[o + 3]}`);
  }

  // statistik: berapa pixel alpha>40, mean RGB di area alpha>40
  let n = 0, r = 0, g = 0, b = 0;
  let minA = 255, maxA = 0;
  for (let i = 0; i < W * H; i++) {
    const a = img.data[i * 4 + 3];
    minA = Math.min(minA, a);
    maxA = Math.max(maxA, a);
    if (a > 40) { n++; r += img.data[i * 4]; g += img.data[i * 4 + 1]; b += img.data[i * 4 + 2]; }
  }
  console.log(`opaque=${n}/${W * H}, mean RGB=(${(r / n).toFixed(1)},${(g / n).toFixed(1)},${(b / n).toFixed(1)}), alpha range=${minA}-${maxA}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
