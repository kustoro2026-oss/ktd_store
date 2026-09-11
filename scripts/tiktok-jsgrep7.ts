// tiktok-jsgrep7.ts — cari chunk lazy & mapping 33454
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const out: string[] = [];
const terms = ['33454', "min.js", "chunk", "oec-captcha", ".js.cjs", "p+"];
for (const t of terms) {
  let p = 0, c = 0;
  while (p < s.length && c < 4) {
    const i = s.indexOf(t, p);
    if (i < 0) break;
    out.push(`### ${t} @ ${i}: ` + s.slice(Math.max(0, i - 300), i + 350).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js19.txt", out.join("\n\n"));
console.log("done");
