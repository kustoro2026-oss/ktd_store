// tiktok-btn.ts — ekstrak modul slide button (sekitar 250000-262000)
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const chunk = s.slice(250500, 262500);
fs.writeFileSync("tiktok-upload/js26.txt", chunk);
const out: string[] = [];
for (const pat of ['"btn"', "updateDragPos", "onStart", "onDrag", "appendTrack", "slidingToggle", "trackSlide"]) {
  let p = 0, c = 0;
  while (c < 6) {
    const i = chunk.indexOf(pat, p);
    if (i < 0) break;
    out.push(`### ${pat} @${i}: ` + chunk.slice(Math.max(0, i - 450), i + 450).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js27.txt", out.join("\n\n"));
console.log("done", out.length);
