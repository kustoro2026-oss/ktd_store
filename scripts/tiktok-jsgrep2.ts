// tiktok-jsgrep2.ts — cari handler drag "img" (dengan koma) & fungsi submit
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const out: string[] = [];
const terms = [',"img")', ',"img"', "dragPos", "trackDrag", "handleDrag", "handleStart", "handleStop", "onSubmit"];
for (const t of terms) {
  let p = 0, c = 0;
  while (p < s.length && c < 5) {
    const i = s.indexOf(t, p);
    if (i < 0) break;
    out.push(`### ${t} @ ${i}: ` + s.slice(Math.max(0, i - 500), i + 600).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js12.txt", out.join("\n\n"));
console.log("done");
