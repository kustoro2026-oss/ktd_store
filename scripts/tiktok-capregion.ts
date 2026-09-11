// tiktok-capregion.ts — ASCII render wilayah tertentu + render piece
// args: x0 y0 x1 y1 [step]
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");
const CH = " .:-=+*#%@";

async function render(img: any, x0: number, y0: number, x1: number, y1: number, step: number, alphaAware = false) {
  const buf = alphaAware ? await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true }) : await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = buf.info.width, H = buf.info.height;
  const ch = alphaAware ? 4 : 3;
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y += step) {
    let line = "";
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x += step) {
      const o = (y * W + x) * ch;
      let c: number;
      if (alphaAware) {
        const a = buf.data[o + 3];
        if (a < 40) { line += " "; continue; }
        c = 0.299 * buf.data[o] + 0.587 * buf.data[o + 1] + 0.114 * buf.data[o + 2];
      } else {
        c = 0.299 * buf.data[o] + 0.587 * buf.data[o + 1] + 0.114 * buf.data[o + 2];
      }
      line += CH[Math.min(9, Math.floor(c / 25.6))];
    }
    console.log(`${String(y).padStart(3)}|${line}`);
  }
  console.log(`    x: ${x0}..${x1} (step ${step})`);
}

async function main() {
  const args = process.argv.slice(2);
  const main = sharp(fs.readFileSync(path.join(OUT, "cap-main.jpg")));
  const piece = sharp(fs.readFileSync(path.join(OUT, "cap-piece.png")));
  if (args[0] === "piece") {
    const step = args[1] ? +args[1] : 1;
    await render(piece, 0, 0, 110, 110, step, true);
  } else if (args[0] !== undefined) {
    const [x0, y0, x1, y1] = [+args[0], +args[1], +args[2], +args[3]];
    const step = args[4] ? +args[4] : 2;
    await render(main, x0, y0, x1, y1, step);
  } else {
    await render(piece, 0, 0, 110, 110, 2, true);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
