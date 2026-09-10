/**
 * Buat gambar "Tabel Ukuran" (Bagan Ukuran) untuk upload TikTok Shop.
 * Output: public/tabel-ukuran.png (dipasang di tiktok-pakaian-fix.ts)
 * Jalankan: node scripts/tiktok-sizechart.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as sharpNS from "sharp";
const sharp: any = (sharpNS as any).default ?? sharpNS;

const svg = `
<svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="800" fill="white"/>
  <text x="300" y="60" font-family="Arial" font-size="32" font-weight="bold" text-anchor="middle" fill="#111111">TABEL UKURAN</text>
  <text x="300" y="100" font-family="Arial" font-size="18" text-anchor="middle" fill="#444444">Ukuran Kemeja Dewasa (S - XXL) dalam cm</text>
  <g stroke="#999999" stroke-width="2">
    <line x1="60" y1="130" x2="540" y2="130"/><line x1="60" y1="230" x2="540" y2="230"/>
    <line x1="60" y1="330" x2="540" y2="330"/><line x1="60" y1="430" x2="540" y2="430"/>
    <line x1="60" y1="530" x2="540" y2="530"/><line x1="60" y1="630" x2="540" y2="630"/>
    <line x1="60" y1="130" x2="60" y2="630"/><line x1="220" y1="130" x2="220" y2="630"/>
    <line x1="380" y1="130" x2="380" y2="630"/><line x1="540" y1="130" x2="540" y2="630"/>
  </g>
  <g font-family="Arial" font-size="20" text-anchor="middle" fill="#111111">
    <text x="140" y="180" font-weight="bold">Ukuran</text>
    <text x="300" y="180" font-weight="bold">Lingkar Dada</text>
    <text x="460" y="180" font-weight="bold">Panjang</text>
    <text x="140" y="280">S</text><text x="300" y="280">100</text><text x="460" y="280">67</text>
    <text x="140" y="380">M</text><text x="300" y="380">106</text><text x="460" y="380">69</text>
    <text x="140" y="480">L</text><text x="300" y="480">112</text><text x="460" y="480">71</text>
    <text x="140" y="580">XL</text><text x="300" y="580">118</text><text x="460" y="580">73</text>
    <text x="140" y="680">XXL</text><text x="300" y="680">124</text><text x="460" y="680">75</text>
  </g>
  <text x="300" y="760" font-family="Arial" font-size="16" text-anchor="middle" fill="#666666">Toleransi ukuran 1-3 cm</text>
</svg>`;

const svgAnak = `
<svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="800" fill="white"/>
  <text x="300" y="60" font-family="Arial" font-size="32" font-weight="bold" text-anchor="middle" fill="#111111">TABEL UKURAN</text>
  <text x="300" y="100" font-family="Arial" font-size="18" text-anchor="middle" fill="#444444">Ukuran Pakaian Anak dalam cm</text>
  <g stroke="#999999" stroke-width="2">
    <line x1="60" y1="130" x2="540" y2="130"/><line x1="60" y1="230" x2="540" y2="230"/>
    <line x1="60" y1="330" x2="540" y2="330"/><line x1="60" y1="430" x2="540" y2="430"/>
    <line x1="60" y1="530" x2="540" y2="530"/><line x1="60" y1="630" x2="540" y2="630"/>
    <line x1="60" y1="130" x2="60" y2="630"/><line x1="220" y1="130" x2="220" y2="630"/>
    <line x1="380" y1="130" x2="380" y2="630"/><line x1="540" y1="130" x2="540" y2="630"/>
  </g>
  <g font-family="Arial" font-size="20" text-anchor="middle" fill="#111111">
    <text x="140" y="180" font-weight="bold">Usia</text>
    <text x="300" y="180" font-weight="bold">Lingkar Dada</text>
    <text x="460" y="180" font-weight="bold">Panjang</text>
    <text x="140" y="280">3-4 Th</text><text x="300" y="280">60</text><text x="460" y="280">55</text>
    <text x="140" y="380">5-6 Th</text><text x="300" y="380">66</text><text x="460" y="380">60</text>
    <text x="140" y="480">7-8 Th</text><text x="300" y="480">72</text><text x="460" y="480">65</text>
    <text x="140" y="580">9-10 Th</text><text x="300" y="580">78</text><text x="460" y="580">70</text>
    <text x="140" y="680">11-12 Th</text><text x="300" y="680">84</text><text x="460" y="680">75</text>
  </g>
  <text x="300" y="760" font-family="Arial" font-size="16" text-anchor="middle" fill="#666666">Toleransi ukuran 1-3 cm</text>
</svg>`;

const OUT = path.resolve("public/tabel-ukuran.png");
const OUT_ANAK = path.resolve("public/tabel-ukuran-anak.png");

sharp(Buffer.from(svg))
  .png()
  .toFile(OUT)
  .then((i: any) => {
    console.log("OK:", OUT, `| ${i.width}x${i.height} | ${fs.statSync(OUT).size} bytes`);
    return sharp(Buffer.from(svgAnak)).png().toFile(OUT_ANAK);
  })
  .then((i: any) => {
    console.log("OK:", OUT_ANAK, `| ${i.width}x${i.height} | ${fs.statSync(OUT_ANAK).size} bytes`);
  })
  .catch((e: any) => console.error("ERR:", e.message));
