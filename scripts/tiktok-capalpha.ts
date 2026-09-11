// tiktok-capalpha.ts — alpha value piece di tepi kiri & kanan baris penuh
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const piece = await sharp(fs.readFileSync(path.join(OUT, "cap-piece.png"))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const PW = piece.info.width, PH = piece.info.height;
  for (const py of [25, 30, 33, 40, 48, 53, 60, 70, 78, 85, 95, 100]) {
    let line = "py=" + String(py).padStart(3) + " L: ";
    for (let px = 0; px <= 12; px++) line += `${piece.data[(py * PW + px) * 4 + 3]},`;
    line += " ... R: ";
    for (let px = PW - 13; px < PW; px++) line += `${piece.data[(py * PW + px) * 4 + 3]},`;
    console.log(line);
  }
  // nilai alpha di px=4 s.d 7 rata-rata
  let a4 = 0, a5 = 0, a6 = 0, a7 = 0, n = 0;
  for (let py = 24; py <= 51; py++) {
    a4 += piece.data[(py * PW + 4) * 4 + 3]; a5 += piece.data[(py * PW + 5) * 4 + 3];
    a6 += piece.data[(py * PW + 6) * 4 + 3]; a7 += piece.data[(py * PW + 7) * 4 + 3]; n++;
  }
  console.log(`\navg alpha rows24-51: px4=${(a4 / n).toFixed(1)} px5=${(a5 / n).toFixed(1)} px6=${(a6 / n).toFixed(1)} px7=${(a7 / n).toFixed(1)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
