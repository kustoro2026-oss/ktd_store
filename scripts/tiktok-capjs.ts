// tiktok-capjs.ts — grep captcha.js untuk memahami layout & data captcha
import * as fs from "node:fs";

const t = fs.readFileSync("tiktok-upload/captcha.js", "utf8");

const kws = ["captcha_verify_img_slide", "img_slide", "slide_", "posY", "offsetY", "offsetTop", "mainImg", "bgImage", "drag_img", "puzzle"];
for (const kw of kws) {
  let i = 0, c = 0;
  while ((i = t.indexOf(kw, i)) >= 0 && c < 4) {
    console.log(`\n=== ${kw} @ ${i} ===`);
    console.log(t.slice(Math.max(0, i - 250), i + 350));
    i += kw.length;
    c++;
  }
}
