// tiktok-capview.ts — render zoom crops for visual inspection
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const main = sharp(fs.readFileSync(path.join(OUT, "cap-main.jpg")));
  const meta = await main.metadata();
  console.log("main meta:", meta.width, meta.height, meta.format);

  const piece = sharp(fs.readFileSync(path.join(OUT, "cap-piece.png")));
  const pmeta = await piece.metadata();
  console.log("piece meta:", pmeta.width, pmeta.height, pmeta.format);

  // hole crop (generous)
  await sharp(fs.readFileSync(path.join(OUT, "cap-main.jpg")))
    .extract({ left: 370, top: 75, width: 140, height: 130 })
    .resize(560, 520, { kernel: "nearest" })
    .png()
    .toFile(path.join(OUT, "cap-hole-crop.png"));

  // piece scaled to same zoom as hole (hole is natural 1:1; crop scaled 4x -> piece 4x = 440)
  await sharp(fs.readFileSync(path.join(OUT, "cap-piece.png")))
    .resize(440, 440, { kernel: "nearest" })
    .png()
    .toFile(path.join(OUT, "cap-piece-zoom.png"));

  console.log("done");
}

main().catch((e) => { console.error(e); process.exit(1); });
