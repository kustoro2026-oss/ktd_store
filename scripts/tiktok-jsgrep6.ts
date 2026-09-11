// tiktok-jsgrep6.ts — cari render ImgSlide (B[2474]) & handler drag parent
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const out: string[] = [];
const terms = ["B[2474].v", "2474]", "trackSlide(", "updateDragPos(", "update({drag_pos", "drag_pos:{x:"];
for (const t of terms) {
  let p = 0, c = 0;
  while (p < s.length && c < 5) {
    const i = s.indexOf(t, p);
    if (i < 0) break;
    out.push(`### ${t} @ ${i}: ` + s.slice(Math.max(0, i - 400), i + 600).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js18.txt", out.join("\n\n"));
console.log("done");
