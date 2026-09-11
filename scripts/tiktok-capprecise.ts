// tiktok-capprecise.ts — batas presisi: bbox konten potongan + tepi kiri/kanan gap
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const piece = await sharp(fs.readFileSync(path.join(OUT, "cap-piece.png"))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const main = await sharp(fs.readFileSync(path.join(OUT, "cap-main.jpg"))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const PW = piece.info.width, PH = piece.info.height;
  const MW = main.info.width, MH = main.info.height;

  // 1) bbox konten opaque potongan
  let minX = PW, minY = PH, maxX = 0, maxY = 0;
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++)
      if (piece.data[(y * PW + x) * 4 + 3] > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  console.log(`bbox potongan: x ${minX}..${maxX}, y ${minY}..${maxY} (dari ${PW}x${PH})`);

  // 2) tepi gap: scan baris y=120 (natural), cari transisi terang->gelap ("pinggir :")
  const lum = (b: Buffer, w: number, ch: number, x: number, y: number) => {
    const o = (y * w + x) * ch;
    return 0.299 * b[o] + 0.587 * b[o + 1] + 0.114 * b[o + 2];
  };
  const gapY = 120;
  const row = [];
  for (let x = 0; x < MW; x++) row.push(lum(main.data, MW, 3, x, gapY));
  // tepi kiri gap: lum turun drastis vs rata-rata kiri (misal jendela 20px)
  let leftEdge = -1, rightEdge = -1;
  for (let x = 30; x < MW - 30; x++) {
    const before = (row[x - 3] + row[x - 2] + row[x - 1]) / 3;
    const after = (row[x] + row[x + 1] + row[x + 2]) / 3;
    if (before - after > 40 && leftEdge < 0) leftEdge = x;
    else if (after - before > 40 && leftEdge > 0 && rightEdge < 0) rightEdge = x - 1;
  }
  console.log(`tepi gap (y=${gapY}): kiri=${leftEdge}, kanan=${rightEdge}, lebar=${rightEdge - leftEdge + 1}`);

  // tepi gap per baris y=110..190 untuk cek konsistensi
  console.log("profil tepi per baris:");
  for (let y = 108; y <= 192; y += 12) {
    const r = [];
    for (let x = 0; x < MW; x++) r.push(lum(main.data, MW, 3, x, y));
    let l = -1, rr = -1;
    for (let x = 30; x < MW - 30; x++) {
      const b = (r[x - 3] + r[x - 2] + r[x - 1]) / 3;
      const a = (r[x] + r[x + 1] + r[x + 2]) / 3;
      if (b - a > 40 && l < 0) l = x;
      else if (a - b > 40 && l > 0 && rr < 0) rr = x - 1;
    }
    console.log(`  y=${y}: kiri=${l} kanan=${rr}`);
  }

  // 3) drag yang diperlukan
  const scale = 340 / MW; // display px per natural px
  const drag = (leftEdge - minX) * scale;
  console.log(`\nscale=${scale.toFixed(4)}`);
  console.log(`DRAG = (${leftEdge} - ${minX}) * ${scale.toFixed(4)} = ${drag.toFixed(1)} display px`);
  console.log(`kandidat lain (kiri-2): ${((leftEdge - 2 - minX) * scale).toFixed(1)}, (kiri+2): ${((leftEdge + 2 - minX) * scale).toFixed(1)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
