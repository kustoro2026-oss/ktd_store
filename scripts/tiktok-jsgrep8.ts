// tiktok-jsgrep8.ts — cari chunk map untuk module 33454
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const out: string[] = [];
const terms = ["33454:", "33454]", ",33454", "[33454", "window.webpackJsonp", "webpackJsonp"];
for (const t of terms) {
  let p = 0, c = 0;
  while (p < s.length && c < 5) {
    const i = s.indexOf(t, p);
    if (i < 0) break;
    out.push(`### ${t} @ ${i}: ` + s.slice(Math.max(0, i - 200), i + 400).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js20.txt", out.join("\n\n"));
console.log("done");
