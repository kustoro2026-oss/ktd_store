// tiktok-jsgrep5.ts — cari track recording & transform reply
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const out: string[] = [];
const terms = ["drag_track.push", "drag_track:", "drag_track]", "relative_time", "mouse_track", "slide_btn_track", "appendTrack", "transform()", "modified_img_width"];
for (const t of terms) {
  let p = 0, c = 0;
  while (p < s.length && c < 5) {
    const i = s.indexOf(t, p);
    if (i < 0) break;
    out.push(`### ${t} @ ${i}: ` + s.slice(Math.max(0, i - 350), i + 500).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js17.txt", out.join("\n\n"));
console.log("done");
