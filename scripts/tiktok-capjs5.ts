// tiktok-capjs5.ts — cari definisi B[2109] & B[2361] & tip_x/tip_y parsing + submit trail
import * as fs from "node:fs";

const t = fs.readFileSync("tiktok-upload/captcha.js", "utf8");

function grep(kw: string, n = 6, ctx = 500) {
  let i = 0, c = 0;
  while ((i = t.indexOf(kw, i)) >= 0 && c < n) {
    console.log(`\n=== ${kw} @ ${i} ===`);
    console.log(t.slice(Math.max(0, i - ctx), i + ctx));
    i += kw.length;
    c++;
  }
}

grep("[2109]=", 6, 400);
grep("[2361]=", 6, 400);
grep("tip_x", 6, 300);
grep("tip_y", 6, 300);
