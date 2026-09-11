// tiktok-jsgrep.ts — cari "img" handler drag di captcha.js
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const out: string[] = [];
let p = 0, c = 0;
while (p < s.length && c < 8) {
  const i = s.indexOf('"img"', p);
  if (i < 0) break;
  out.push(`### @ ${i}: ` + s.slice(Math.max(0, i - 700), i + 500).replace(/\n/g, ""));
  p = i + 1; c++;
}
fs.writeFileSync("tiktok-upload/js11.txt", out.join("\n\n"));
console.log("found", out.length);
