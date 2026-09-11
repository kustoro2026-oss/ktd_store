// tiktok-onload.ts — cari onImgLoad di komponen img wrapper (sekitar 950000-965000)
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const chunk = s.slice(945000, 964900);
fs.writeFileSync("tiktok-upload/js24.txt", chunk);
// tampilkan semua kemunculan onImgLoad & update( di chunk
const out: string[] = [];
for (const pat of ["onImgLoad", "loadQuestionSuccess", "loadAnswerSuccess", "update({", "loading:!1", "slide_btn_able:!0"]) {
  let p = 0, c = 0;
  while (c < 5) {
    const i = chunk.indexOf(pat, p);
    if (i < 0) break;
    out.push(`### ${pat}: ` + chunk.slice(Math.max(0, i - 350), i + 350).replace(/\n/g, ""));
    p = i + 1; c++;
  }
}
fs.writeFileSync("tiktok-upload/js25.txt", out.join("\n\n"));
console.log("done", out.length);
