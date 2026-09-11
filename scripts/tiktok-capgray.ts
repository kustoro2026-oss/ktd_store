// tiktok-capgray.ts — petakan region ABU-ABU (dimmed hole) di main image
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const main = await sharp(fs.readFileSync(path.join(OUT, "cap-main.jpg"))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const MW = main.info.width, MH = main.info.height;

  // gray mask: R~G~B dan L <= 210
  const gray = new Uint8Array(MW * MH);
  for (let i = 0; i < MW * MH; i++) {
    const o = i * 3;
    const r = main.data[o], g = main.data[o + 1], b = main.data[o + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (Math.abs(r - g) <= 12 && Math.abs(g - b) <= 12 && lum <= 210) gray[i] = 1;
  }

  // ringkasan per baris
  console.log("Per-row gray pixels (y: count, x-range):");
  for (let y = 0; y < MH; y++) {
    let cnt = 0, x0 = -1, x1 = -1;
    for (let x = 0; x < MW; x++) {
      if (gray[y * MW + x]) { cnt++; if (x0 < 0) x0 = x; x1 = x; }
    }
    if (cnt > 0) console.log(`  y=${y}: n=${cnt} x=${x0}..${x1}`);
  }

  // bounding box keseluruhan
  let minX = MW, maxX = -1, minY = MH, maxY = -1, total = 0;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (gray[y * MW + x]) { total++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  console.log(`\nTOTAL gray=${total}, bbox x=${minX}..${maxX} y=${minY}..${maxY}`);
  console.log(`scale=340/552=${(340 / 552).toFixed(5)}`);
  if (maxX >= 0) {
    console.log(`hole center x natural = ${((minX + maxX) / 2).toFixed(1)}`);
    console.log(`drag px = ${(((minX + maxX) / 2) * (340 / 552)).toFixed(1)}`);
    // rata-rata x berbobot per y (untuk lihat bentuk)
    console.log("\nWeighted x per row (y: meanX, minX..maxX):");
    for (let y = minY; y <= maxY; y++) {
      let s = 0, n = 0, x0 = -1, x1 = -1;
      for (let x = minX; x <= maxX; x++) {
        if (gray[y * MW + x]) { s += x; n++; if (x0 < 0) x0 = x; x1 = x; }
      }
      if (n > 0) console.log(`  y=${y}: meanX=${(s / n).toFixed(1)} range=${x0}..${x1} n=${n}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
