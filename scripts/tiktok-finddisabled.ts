// tiktok-finddisabled.ts — cari kondisi disabled & slide_btn_able di captcha.js
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const out: string[] = [];
for (const pat of ["disabled:", "slide_btn_able", "drag_type"]) {
  let p = 0, c = 0;
  while (p < s.length && c < 6) {
    const i = s.indexOf(pat, p);
    if (i < 0) break;
    out.push(`### ${pat} @ ${i}: ` + s.slice(Math.max(0, i - 300), i + 300).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js22.txt", out.join("\n\n"));
console.log("total matches written:", out.length);
