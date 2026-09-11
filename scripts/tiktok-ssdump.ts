// tiktok-ssdump.ts — dump sharedStrings t1 untuk memetakan header kolom penuh
import * as fs from "node:fs";
const s = fs.readFileSync("tiktok-template/x1tmp/xl/sharedStrings.xml", "utf8");
// ambil semua <si>...</si> beserta indeksnya (urut)
const sis = [...s.matchAll(/<si>([\s\S]*?)<\/si>/g)];
console.log("total si:", sis.length);
const textOf = (xml: string) => {
  const parts = [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]);
  return parts
    .join("")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#160;/g, "\u00a0")
    .replace(/&#10;/g, "\n");
};
sis.forEach((m, i) => {
  const t = textOf(m[1]);
  if (i >= 34) console.log(i, JSON.stringify(t.slice(0, 60)));
});
