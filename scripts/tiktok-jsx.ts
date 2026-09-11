// tiktok-jsx.ts — extract submit saga & drag handlers
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
fs.writeFileSync("tiktok-upload/js14.txt", s.slice(670500, 678500));
// cari juga fungsi trackSlide & updateDragPos reducer
const terms = ["trackSlide", "setDragWidth", "updateDragPos", "drag_width"];
const out: string[] = [];
for (const t of terms) {
  let p = 0, c = 0;
  while (p < s.length && c < 5) {
    const i = s.indexOf(t, p);
    if (i < 0) break;
    out.push(`### ${t} @ ${i}: ` + s.slice(Math.max(0, i - 300), i + 400).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js15.txt", out.join("\n\n"));
console.log("done");
