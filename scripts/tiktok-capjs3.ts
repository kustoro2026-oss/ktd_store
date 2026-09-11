// tiktok-capjs3.ts — cari cara drag_pos & x offset di-set dari data captcha
import * as fs from "node:fs";

const t = fs.readFileSync("tiktok-upload/captcha.js", "utf8");

function grep(kw: string, n = 6, ctx = 400) {
  let i = 0, c = 0;
  while ((i = t.indexOf(kw, i)) >= 0 && c < n) {
    console.log(`\n=== ${kw} @ ${i} ===`);
    console.log(t.slice(Math.max(0, i - ctx), i + ctx));
    i += kw.length;
    c++;
  }
}

grep("[56].v=", 8, 350);
grep("drag_pos", 8, 300);
grep("updateDragPos", 4, 250);
