// tiktok-capjs4.ts — ekstrak render function besar (964924) & fungsi drag/submit
import * as fs from "node:fs";

const t = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
console.log("=== render @ 964600-968200 ===");
console.log(t.slice(964600, 968200));
