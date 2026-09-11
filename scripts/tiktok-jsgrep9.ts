// tiktok-jsgrep9.ts — cari modul 23898 (B[2465] transform) & modul r() (40440)
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const out: string[] = [];
for (const t of ["23898:", "40440:", "23898:function", "40440:function"]) {
  let p = 0, c = 0;
  while (p < s.length && c < 3) {
    const i = s.indexOf(t, p);
    if (i < 0) break;
    out.push(`### ${t} @ ${i}: ` + s.slice(i, i + 2600).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js21.txt", out.join("\n\n"));
console.log("done");
