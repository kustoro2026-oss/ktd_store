// tiktok-dragcls.ts — ekstrak kelas Draggable lengkap (sekitar 423500-425200)
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const chunk = s.slice(423500, 425400);
fs.writeFileSync("tiktok-upload/js30.txt", chunk);
const out: string[] = [];
for (const pat of ["callEventHandler", "createDraggableData", "onDragStart", "handleDragStart", "onDrag:"]) {
  let p = 0, c = 0;
  while (c < 6) {
    const i = chunk.indexOf(pat, p);
    if (i < 0) break;
    out.push(`### ${pat} @${i}: ` + chunk.slice(Math.max(0, i - 300), i + 500).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js31.txt", out.join("\n\n"));
console.log("done", out.length);
