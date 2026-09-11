// tiktok-capjs2.ts — cari nilai B[2109], penggunaan c.x/c.y, slide_mode_image_x_offset
import * as fs from "node:fs";

const t = fs.readFileSync("tiktok-upload/captcha.js", "utf8");

function grep(kw: string, n = 6, ctx = 300) {
  let i = 0, c = 0;
  while ((i = t.indexOf(kw, i)) >= 0 && c < n) {
    console.log(`\n=== ${kw} @ ${i} ===`);
    console.log(t.slice(Math.max(0, i - ctx), i + ctx));
    i += kw.length;
    c++;
  }
}

grep("2109]=", 4, 250);
grep("slide_mode_image_x_offset", 6, 300);
grep("image_x_offset", 8, 250);
