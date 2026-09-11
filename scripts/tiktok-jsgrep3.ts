// tiktok-jsgrep3.ts — cari update drag_pos selama drag & fungsi submit slide
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const out: string[] = [];
const terms = ["drag_pos:{x:", "drag_pos:x", "x:Math", "x:c.x", ".x=t.x", "drag_track", "slideTrack", "verifySlide", "submitSlide"];
for (const t of terms) {
  let p = 0, c = 0;
  while (p < s.length && c < 4) {
    const i = s.indexOf(t, p);
    if (i < 0) break;
    out.push(`### ${t} @ ${i}: ` + s.slice(Math.max(0, i - 500), i + 700).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js13.txt", out.join("\n\n"));
console.log("done");
