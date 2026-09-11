// tiktok-capshape.ts — profil alpha lengkap piece per baris (min/max px konten)
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const piece = await sharp(fs.readFileSync(path.join(OUT, "cap-piece.png"))).raw().toBuffer({ resolveWithObject: true });
  const PW = piece.info.width, PH = piece.info.height;
  console.log(`piece ${PW}x${PH} channels=${piece.info.channels}`);
  for (let py = 0; py < PH; py++) {
    let minA10 = -1, maxA10 = -1, minA128 = -1, maxA128 = -1, sum = 0;
    let alphas: number[] = [];
    for (let px = 0; px < PW; px++) {
      const a = piece.data[py * PW * 4 + px * 4 + 3];
      if (a > 10) { if (minA10 < 0) minA10 = px; maxA10 = px; }
      if (a >= 128) { if (minA128 < 0) minA128 = px; maxA128 = px; }
      if (a > 0) sum += a;
    }
    if (sum > 0) {
      console.log(`py=${py}: a10=${minA10}..${maxA10} a128=${minA128 < 0 ? "-" : minA128 + ".." + maxA128} sum=${sum}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
