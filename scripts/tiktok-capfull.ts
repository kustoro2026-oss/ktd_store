// tiktok-capfull.ts — ASCII penuh gambar utama (552x344, sampel 6x6)
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const mainBuf = fs.readFileSync(path.join(OUT, "cap-main.jpg"));
  const main = await sharp(mainBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const MW = main.info.width, MH = main.info.height;
  const chars = " .:-=+*#%@";
  const sx = 6, sy = 6;
  for (let y = 0; y < MH; y += sy) {
    let line = "";
    for (let x = 0; x < MW; x += sx) {
      let l = 0, cnt = 0;
      for (let dy = 0; dy < sy && y + dy < MH; dy++)
        for (let dx = 0; dx < sx && x + dx < MW; dx++) {
          const o = ((y + dy) * MW + (x + dx)) * 3;
          l += 0.299 * main.data[o] + 0.587 * main.data[o + 1] + 0.114 * main.data[o + 2];
          cnt++;
        }
      line += chars.charAt(Math.min(9, Math.floor(l / cnt / 26)));
    }
    console.log(line);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
