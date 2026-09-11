// tiktok-jsgrep4.ts — cari konversi drag: data.x, dragWidth, dX
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const out: string[] = [];
const terms = ["data.x", "dragWidth", ".dX", "B[2464].v=", "2464].v.dragWidth", "offsetXYFromParent", "getControlPosition"];
for (const t of terms) {
  let p = 0, c = 0;
  while (p < s.length && c < 6) {
    const i = s.indexOf(t, p);
    if (i < 0) break;
    out.push(`### ${t} @ ${i}: ` + s.slice(Math.max(0, i - 350), i + 450).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js16.txt", out.join("\n\n"));
console.log("done");
