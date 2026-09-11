// tiktok-dragcls2.ts — lanjutan kelas Draggable (425000-430000)
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const chunk = s.slice(425000, 430500);
fs.writeFileSync("tiktok-upload/js32.txt", chunk);
const out: string[] = [];
for (const pat of ["onDragStart", "onDrag:", "handleDrag", "callEventHandler", "createDraggableData"]) {
  let p = 0, c = 0;
  while (c < 5) {
    const i = chunk.indexOf(pat, p);
    if (i < 0) break;
    out.push(`### ${pat} @${i}: ` + chunk.slice(Math.max(0, i - 350), i + 550).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js33.txt", out.join("\n\n"));
console.log("done", out.length);
