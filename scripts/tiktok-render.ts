// tiktok-render.ts — ekstrak render lengkap komponen img wrapper (@964000-969000)
import * as fs from "node:fs";

const s = fs.readFileSync("tiktok-upload/captcha.js", "utf8");
const chunk = s.slice(963900, 969500);
fs.writeFileSync("tiktok-upload/js23.txt", chunk);
console.log("len", chunk.length);
