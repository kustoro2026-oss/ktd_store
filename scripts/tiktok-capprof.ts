// tiktok-capprof.ts — profil luminance horizontal untuk menemukan tepi hole (new band y87-187)
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const main = await sharp(fs.readFileSync(path.join(OUT, "cap-main.jpg"))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const MW = main.info.width;

  const rows = [90, 100, 107, 110, 112, 115, 118, 121, 124, 130, 137, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190];
  for (const y of rows) {
    let line = "";
    for (let x = 370; x <= 540; x++) {
      const o = (y * MW + x) * 3;
      const lum = Math.round(0.299 * main.data[o] + 0.587 * main.data[o + 1] + 0.114 * main.data[o + 2]);
      line += String(lum).padStart(3) + " ";
    }
    console.log(`y=${y}: ${line}`);
  }
  console.log("---");
  // grid guide
  let guide = "x=    ";
  for (let x = 370; x <= 540; x += 10) guide += String(x).padStart(20);
  console.log(guide);
}

main().catch((e) => { console.error(e); process.exit(1); });
