// tiktok-capro3.ts — profil luminance untuk challenge y=63 (hole top ~126)
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

async function main() {
  const main = await sharp(fs.readFileSync(path.join("tiktok-upload", "cap-main.jpg"))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const MW = main.info.width;
  const rows = [104, 110, 114, 118, 122, 126, 130, 136, 142, 150, 158, 166, 174, 182, 190, 198, 206, 214, 222];
  for (const y of rows) {
    let line = "";
    for (let x = 280; x <= 480; x++) {
      const o = (y * MW + x) * 3;
      const lum = Math.round(0.299 * main.data[o] + 0.587 * main.data[o + 1] + 0.114 * main.data[o + 2]);
      line += String(lum).padStart(3) + " ";
    }
    console.log(`y=${y}: ${line}`);
  }
  console.log("x=" + Array.from({ length: 21 }, (_, i) => String(280 + i * 10).padStart(26)).join(" "));
}

main().catch((e) => { console.error(e); process.exit(1); });
