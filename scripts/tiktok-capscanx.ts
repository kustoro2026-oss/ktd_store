// tiktok-capscanx.ts — scan x saja pada y = bandTop (posisi tetap potongan)
// metrik: NCC(main, piece) + k (faktor gelap). Cetak top 10 + profil untuk y sedikit bergeser.
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const offsetYStr = process.argv[2] ?? "81.296875";
  const piece = await sharp(fs.readFileSync(path.join(OUT, "cap-piece.png"))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const main = await sharp(fs.readFileSync(path.join(OUT, "cap-main.jpg"))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const PW = piece.info.width, PH = piece.info.height;
  const MW = main.info.width, MH = main.info.height;
  const scale = 340 / MW;

  const alpha = new Uint8Array(PW * PH);
  for (let i = 0; i < PW * PH; i++) alpha[i] = piece.data[i * 4 + 3] > 40 ? 1 : 0;
  const pLum = new Float32Array(PW * PH);
  for (let i = 0; i < PW * PH; i++) {
    const o = i * 4;
    pLum[i] = 0.299 * piece.data[o] + 0.587 * piece.data[o + 1] + 0.114 * piece.data[o + 2];
  }
  const mLum = new Float32Array(MW * MH);
  for (let i = 0; i < MW * MH; i++) {
    const o = i * 3;
    mLum[i] = 0.299 * main.data[o] + 0.587 * main.data[o + 1] + 0.114 * main.data[o + 2];
  }

  const bandTop = Math.round(parseFloat(offsetYStr) / scale);
  console.log(`bandTop=${bandTop}`);

  const scoreAt = (x: number, y: number) => {
    let sp = 0, sm = 0, spp = 0, smm = 0, spm = 0, dsum = 0, lsum = 0, n = 0;
    let a = 0, b = 0, c = 0;
    for (let py = 0; py < PH; py++) {
      for (let px = 0; px < PW; px++) {
        const i = py * PW + px;
        if (!alpha[i]) continue;
        const p = pLum[i], m = mLum[(y + py) * MW + (x + px)];
        sp += p; sm += m; spp += p * p; smm += m * m; spm += p * m;
        const d = p - m;
        a += d * p; b += p * p; c += d * d;
        dsum += d; lsum += p; n++;
      }
    }
    const ncc = (n * spm - sp * sm) / (Math.sqrt(n * spp - sp * sp) * Math.sqrt(n * smm - sm * sm) + 1e-6);
    const dcorr = a / (Math.sqrt(b) * Math.sqrt(c) + 1e-6);
    return { ncc, dcorr, k: dsum / (lsum + 1e-6), n };
  };

  // scan x di bandTop-6..bandTop+18 (mask bisa beberapa px di bawah track)
  const results: { x: number; y: number; ncc: number; dcorr: number; k: number }[] = [];
  for (let y = bandTop - 6; y <= bandTop + 18; y++) {
    for (let x = 0; x <= MW - PW; x++) {
      const s = scoreAt(x, y);
      results.push({ x, y, ncc: s.ncc, dcorr: s.dcorr, k: s.k });
    }
  }
  // kandidat mask gelap: dcorr tinggi DAN ncc positif
  const mask = results.filter((r) => r.dcorr > 0.7 && r.ncc > 0.05).sort((a, b) => b.dcorr - a.dcorr);
  console.log("Kandidat mask (dcorr>0.7, ncc>0.05):");
  for (const r of mask.slice(0, 12)) console.log(`  x=${r.x} y=${r.y} ncc=${r.ncc.toFixed(3)} dcorr=${r.dcorr.toFixed(3)} k=${r.k.toFixed(2)}`);
  const best = mask[0] ?? results[0];
  console.log(`DRAG = ${(best.x * scale).toFixed(2)} display px`);
  fs.writeFileSync(path.join(OUT, "cap-solve.json"), JSON.stringify({ best, drag: best.x * scale, bandTop, scale }));
}

main().catch((e) => { console.error(e); process.exit(1); });
