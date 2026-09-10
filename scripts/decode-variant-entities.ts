/** Decode entitas HTML di nama/color/size varian pada products.json. */
import * as fs from "node:fs";
import * as path from "node:path";

const f = path.resolve("tiktok-export/products.json");
const a: any[] = JSON.parse(fs.readFileSync(f, "utf8"));
const decode = (s: string) =>
  s.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

let n = 0;
for (const p of a) {
  for (const v of p.variants || []) {
    for (const k of ["name", "color", "size"]) {
      if (typeof v[k] === "string" && /&gt;|&lt;|&amp;|&quot;/.test(v[k])) {
        v[k] = decode(v[k]);
        n++;
      }
    }
  }
}
console.log("field di-decode:", n);
fs.writeFileSync(f, JSON.stringify(a, null, 1));
