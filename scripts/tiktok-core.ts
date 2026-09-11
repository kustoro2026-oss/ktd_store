// tiktok-core.ts — cari createCoreData & Draggable.handleDragStart (komponen Draggable)
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const out: string[] = [];
for (const pat of ["createCoreData", "getDerivedStateFromProps", "createPosition", "prevPropsPosition"]) {
  let p = 0, c = 0;
  while (c < 6) {
    const i = s.indexOf(pat, p);
    if (i < 0) break;
    out.push(`### ${pat} @${i}: ` + s.slice(Math.max(0, i - 400), i + 600).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js29.txt", out.join("\n\n"));
console.log("done", out.length);
