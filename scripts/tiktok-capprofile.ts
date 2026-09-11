// tiktok-capprofile.ts — profil tepi vertikal gambar utama di band potongan
// untuk tiap baris y, cari semua transisi tajam luminance (naik/turun > 35)
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const main = await sharp(fs.readFileSync(path.join(OUT, "cap-main.jpg"))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const MW = main.info.width, MH = main.info.height;
  const lum = (x: number, y: number) => {
    const o = (y * MW + x) * 3;
    return 0.299 * main.data[o] + 0.587 * main.data[o + 1] + 0.114 * main.data[o + 2];
  };
  // smooth row: rata-rata jendela 3
  const row = new Float32Array(MW);
  for (let y = 137; y <= 236; y += 5) {
    for (let x = 0; x < MW; x++) {
      let s = 0, n = 0;
      for (let k = -2; k <= 2; k++) if (x + k >= 0 && x + k < MW) { s += lum(x + k, y); n++; }
      row[x] = s / n;
    }
    const edges: string[] = [];
    for (let x = 4; x < MW - 4; x++) {
      const d = row[x + 3] - row[x - 3];
      if (Math.abs(d) > 25) edges.push(`${d > 0 ? "+" : "-"}${x}`);
    }
    // ringkas jadi range
    console.log(`y=${y}: ${edges.join(" ")}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
