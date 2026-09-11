// tiktok-solve-captcha2.ts — pencocokan gap captcha via korelasi gradien (Sobel)
// + skor difusi. Gap di gambar utama = versi gelap dari potongan (struktur tepi
// dipertahankan), jadi NCC gradien lebih andal daripada selisih piksel.
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function fetchBuf(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Gradien Sobel pada kanal luminance
function grad(b: Buffer, w: number, h: number, ch: number): Float32Array {
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * ch;
    lum[i] = 0.299 * b[o] + 0.587 * b[o + 1] + 0.114 * b[o + 2];
  }
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      gx[i] = -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1] + lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
      gy[i] = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
    }
  }
  const mag = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) mag[i] = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
  return mag;
}

async function main() {
  const pieceUrl = process.argv[2];
  const mainUrl = process.argv[3];
  const pieceBuf = await fetchBuf(pieceUrl);
  const mainBuf = await fetchBuf(mainUrl);
  fs.writeFileSync(path.join(OUT, "cap-piece.png"), pieceBuf);
  fs.writeFileSync(path.join(OUT, "cap-main.jpg"), mainBuf);

  const piece = await sharp(pieceBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const main = await sharp(mainBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const PW = piece.info.width, PH = piece.info.height;
  const MW = main.info.width, MH = main.info.height;
  console.log(`piece ${PW}x${PH}, main ${MW}x${MH}`);

  // Mask alfa potongan (puzzle shape)
  const alpha = new Float32Array(PW * PH);
  for (let i = 0; i < PW * PH; i++) alpha[i] = piece.data[i * 4 + 3] > 40 ? 1 : 0;

  const pGrad = grad(piece.data, PW, PH, 4);
  const mGrad = grad(main.data, MW, MH, 3);

  const bandTop = Math.round((59.125 / 212) * MH);
  const yMin = Math.max(0, bandTop - 25);
  const yMax = Math.min(MH - PH, bandTop + 25);
  const xMax = MW - PW;

  // ASCII preview band utama (downsample ~ x4) untuk cek kasar
  console.log("--- preview band utama (y", bandTop, ") ---");
  for (let y = bandTop; y < bandTop + PH; y += 8) {
    let line = "";
    for (let x = 0; x < MW; x += 4) {
      const o = (y * MW + x) * 3;
      const l = 0.299 * main.data[o] + 0.587 * main.data[o + 1] + 0.114 * main.data[o + 2];
      line += " .:-=+*#%@".charAt(Math.min(9, Math.floor(l / 26)));
    }
    console.log(line);
  }

  // NCC gradien: untuk tiap (x,y), korelasikan pGrad (di area mask) dengan mGrad
  const results: { x: number; y: number; ncc: number; diff: number }[] = [];
  for (let y = yMin; y <= yMax; y += 2) {
    for (let x = 0; x <= xMax; x += 2) {
      let a = 0, b = 0, c = 0, n = 0, dsum = 0;
      for (let py = 2; py < PH - 2; py += 3) {
        for (let pxi = 2; pxi < PW - 2; pxi += 3) {
          if (alpha[py * PW + pxi] < 0.5) continue;
          const g1 = pGrad[py * PW + pxi];
          const g2 = mGrad[(y + py) * MW + (x + pxi)];
          a += g1 * g2; b += g1 * g1; c += g2 * g2; n++;
          const o1 = (py * PW + pxi) * 4, o2 = ((y + py) * MW + (x + pxi)) * 3;
          dsum += Math.abs(piece.data[o1] - main.data[o2]) + Math.abs(piece.data[o1 + 1] - main.data[o2 + 1]) + Math.abs(piece.data[o1 + 2] - main.data[o2 + 2]);
        }
      }
      if (n < 300) continue;
      const ncc = a / (Math.sqrt(b) * Math.sqrt(c) + 1e-6);
      results.push({ x, y, ncc, diff: dsum / n });
    }
  }
  // urutkan: NCC tinggi utama; diff kecil kedua
  results.sort((p, q) => q.ncc - p.ncc);
  console.log("\nTop 15 by NCC:");
  for (const r of results.slice(0, 15)) console.log(`  x=${r.x} y=${r.y} ncc=${r.ncc.toFixed(3)} diff=${r.diff.toFixed(1)}`);
  // filter: NCC > 0.5 lalu ambil diff terkecil
  const cand = results.filter((r) => r.ncc > 0.45).sort((p, q) => p.diff - q.diff);
  console.log("\nTop 10 (NCC>0.45) by diff:");
  for (const r of cand.slice(0, 10)) console.log(`  x=${r.x} y=${r.y} ncc=${r.ncc.toFixed(3)} diff=${r.diff.toFixed(1)}`);
  const best = cand[0] ?? results[0];
  const targetDispX = (best.x / MW) * 340;
  console.log(`\nBEST: x=${best.x} y=${best.y} ncc=${best.ncc.toFixed(3)} diff=${best.diff.toFixed(1)} -> drag display x=${targetDispX.toFixed(1)}`);
  fs.writeFileSync(path.join(OUT, "cap-solve.json"), JSON.stringify({ best, targetDispX, bandTop, PW, PH, MW, MH }));
}

main().catch((e) => { console.error(e); process.exit(1); });
