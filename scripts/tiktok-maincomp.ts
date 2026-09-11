// tiktok-maincomp.ts — cari handler onStart/onDrag/onStop milik komponen utama captcha
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const out: string[] = [];
for (const pat of ["updateDragPos", "appendTrack", "trackSlide", "slidingToggle"]) {
  let p = 0, c = 0;
  while (c < 8) {
    const i = s.indexOf(pat, p);
    if (i < 0) break;
    out.push(`### ${pat} @${i}: ` + s.slice(Math.max(0, i - 500), i + 500).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js28.txt", out.join("\n\n"));
console.log("done", out.length);
