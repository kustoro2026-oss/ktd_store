// tiktok-capviz.ts — visualisasi ASCII: potongan puzzle + wilayah kandidat gap
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const pieceBuf = fs.readFileSync(path.join(OUT, "cap-piece.png"));
  const mainBuf = fs.readFileSync(path.join(OUT, "cap-main.jpg"));
  const piece = await sharp(pieceBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const main = await sharp(mainBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const PW = piece.info.width, PH = piece.info.height;
  const MW = main.info.width, MH = main.info.height;

  const render = (
    b: Buffer, w: number, h: number, ch: number,
    x0: number, y0: number, x1: number, y1: number, sx: number, sy: number,
    alphaArr?: Float32Array
  ) => {
    const chars = " .:-=+*#%@";
    for (let yy = y0; yy < y1; yy += sy) {
      let line = "";
      for (let xx = x0; xx < x1; xx += sx) {
        let l = 0, cnt = 0;
        for (let dy = 0; dy < sy && yy + dy < h; dy++) {
          for (let dx = 0; dx < sx && xx + dx < w; dx++) {
            const i = (yy + dy) * w + (xx + dx);
            if (alphaArr && alphaArr[i] < 0.5) continue;
            const o = i * ch;
            l += 0.299 * b[o] + 0.587 * b[o + 1] + 0.114 * b[o + 2];
            cnt++;
          }
        }
        if (cnt === 0) line += " ";
        else line += chars.charAt(Math.min(9, Math.floor(l / cnt / 26)));
      }
      console.log(line);
    }
  };

  const alpha = new Float32Array(PW * PH);
  for (let i = 0; i < PW * PH; i++) alpha[i] = piece.data[i * 4 + 3] > 40 ? 1 : 0;

  console.log(`=== POTONGAN (${PW}x${PH}), sampel 3px ===`);
  render(piece.data, PW, PH, 4, 0, 0, PW, PH, 3, 3, alpha);
  const args = process.argv.slice(2);
  const rx0 = args[0] !== undefined ? parseInt(args[0]) : 350;
  const ry0 = args[1] !== undefined ? parseInt(args[1]) : 90;
  const rx1 = args[2] !== undefined ? parseInt(args[2]) : 505;
  const ry1 = args[3] !== undefined ? parseInt(args[3]) : 210;
  console.log(`\n=== UTAMA wilayah x=${rx0}..${rx1}, y=${ry0}..${ry1}, sampel 3px ===`);
  render(main.data, MW, MH, 3, rx0, ry0, rx1, ry1, 3, 3);
}

main().catch((e) => { console.error(e); process.exit(1); });
