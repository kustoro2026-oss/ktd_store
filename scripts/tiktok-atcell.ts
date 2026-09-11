// tiktok-atcell.ts — lihat isi sel AT pada baris 7..10 + struktur <row r="8">
import * as fs from "node:fs";
const s = fs.readFileSync("tiktok-template/x1tmp/xl/worksheets/sheet1.xml", "utf8");
for (const n of [7, 8, 9, 10, 2000]) {
  const m = s.match(new RegExp(`<row ([^>]*r="${n}"[^>]*)>([\\s\\S]*?)<\\/row>`));
  if (m) {
    console.log(`--- row ${n} ---`);
    console.log("attrs:", m[1].slice(0, 120));
    console.log("body :", m[2].slice(0, 400));
  }
}
// cari elemen c yang ref-nya AT8
const at = s.match(/<c[^>]*r="AT8"[^>]*\/?>[^<]*<\/c>|<c[^>]*r="AT8"[^>]*\/>/);
console.log("AT8:", at?.[0]);
