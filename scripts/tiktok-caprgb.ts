// tiktok-caprgb.ts — scan RGB least-squares: cari posisi di mana main = piece * k per channel
// (mask bisa gelap ATAU lebih terang dari piece; bisa beda warna)
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tiktok-upload");

async function main() {
  const offsetYStr = process.argv[2] ?? "81.296875";
  const y0s = process.argv[3] ?? "-16";
  const y1s = process.argv[4] ?? "24";
  const piece = await sharp(fs.readFileSync(path.join(OUT, "cap-piece.png"))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const main = await sharp(fs.readFileSync(path.join(OUT, "cap-main.jpg"))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const PW = piece.info.width, PH = piece.info.height;
  const MW = main.info.width, MH = main.info.height;
  const scale = 340 / MW;

  // daftar pixel opaque piece
  const samples: { px: number; py: number; r: number; g: number; b: number }[] = [];
  for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
    const i = py * PW + px;
    if (piece.data[i * 4 + 3] <= 40) continue;
    samples.push({ px, py, r: piece.data[i * 4], g: piece.data[i * 4 + 1], b: piece.data[i * 4 + 2] });
  }
  const n = samples.length;
  // mean piece RGB
  let pr0 = 0, pg0 = 0, pb0 = 0;
  for (const s of samples) { pr0 += s.r; pg0 += s.g; pb0 += s.b; }
  console.log(`piece opaque=${n}, mean RGB=(${(pr0 / n).toFixed(1)},${(pg0 / n).toFixed(1)},${(pb0 / n).toFixed(1)})`);

  const bandTop = Math.round(parseFloat(offsetYStr) / scale);
  const y0 = bandTop + parseInt(y0s), y1 = bandTop + parseInt(y1s);
  console.log(`bandTop=${bandTop}, scan y ${y0}..${y1}, x 0..${MW - PW}`);

  type Cand = { x: number; y: number; rms: number; kr: number; kg: number; kb: number; ncc: number; mean: number };
  const cands: Cand[] = [];

  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x <= MW - PW; x++) {
      let sr = 0, sg = 0, sb = 0; // sum m
      let s2r = 0, s2g = 0, s2b = 0; // sum m^2
      let spmr = 0, spmg = 0, spmb = 0; // sum p*m
      let spr = 0, spg = 0, spb = 0; // sum p
      let sppr = 0, sppg = 0, sppb = 0; // sum p^2
      let sml = 0, spl = 0, spml = 0, sll = 0, sppl = 0; // luminance
      for (const s of samples) {
        const o = ((y + s.py) * MW + (x + s.px)) * 3;
        const mr = main.data[o], mg = main.data[o + 1], mb = main.data[o + 2];
        sr += mr; s2r += mr * mr; spmr += s.r * mr; spr += s.r; sppr += s.r * s.r;
        sg += mg; s2g += mg * mg; spmg += s.g * mg; spg += s.g; sppg += s.g * s.g;
        sb += mb; s2b += mb * mb; spmb += s.b * mb; spb += s.b; sppb += s.b * s.b;
        const ml = 0.299 * mr + 0.587 * mg + 0.114 * mb;
        const pl = 0.299 * s.r + 0.587 * s.g + 0.114 * s.b;
        sml += ml; spl += pl; spml += pl * ml; sll += ml * ml; sppl += pl * pl;
      }
      const kr = spmr / sppr, kg = spmg / sppg, kb = spmb / sppb;
      const rmsR = Math.sqrt(Math.max(0, s2r / n - 2 * kr * spmr / n + kr * kr * sppr / n));
      const rmsG = Math.sqrt(Math.max(0, s2g / n - 2 * kg * spmg / n + kg * kg * sppg / n));
      const rmsB = Math.sqrt(Math.max(0, s2b / n - 2 * kb * spmb / n + kb * kb * sppb / n));
      const rms = Math.sqrt((rmsR * rmsR + rmsG * rmsG + rmsB * rmsB) / 3);
      const ncc = (n * spml - spl * sml) / (Math.sqrt(n * sppl - spl * spl) * Math.sqrt(n * sll - sml * sml) + 1e-6);
      cands.push({ x, y, rms, kr, kg, kb, ncc, mean: sml / n });
    }
  }

  const byRms = [...cands].sort((a, b) => a.rms - b.rms);
  console.log("Top 20 by RGB rms (paling cocok piece*k):");
  for (const c of byRms.slice(0, 20)) {
    console.log(`  x=${c.x} y=${c.y} rms=${c.rms.toFixed(2)} k=(${c.kr.toFixed(2)},${c.kg.toFixed(2)},${c.kb.toFixed(2)}) ncc=${c.ncc.toFixed(3)} mean=${c.mean.toFixed(1)}`);
  }
  fs.writeFileSync(path.join(OUT, "cap-rgb.json"), JSON.stringify({ best: byRms[0], top: byRms.slice(0, 20), bandTop, scale }));
}

main().catch((e) => { console.error(e); process.exit(1); });
