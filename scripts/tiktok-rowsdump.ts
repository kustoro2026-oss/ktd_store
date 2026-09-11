// tiktok-rowsdump.ts — dump semua <row> sheet1.xml (Template) t1
import * as fs from "node:fs";
const s = fs.readFileSync("tiktok-template/x1tmp/xl/worksheets/sheet1.xml", "utf8");
const rows = [...s.matchAll(/<row ([^>]*)>([\s\S]*?)<\/row>/g)].map((m) => ({ attrs: m[1], body: m[2] }));
console.log("jumlah row:", rows.length);
for (const r of rows) {
  const rn = r.attrs.match(/r="(\d+)"/)?.[1];
  const cells = [...r.body.matchAll(/<c r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g)].map((m) => ({
    ref: m[1],
    t: m[2].includes('t="s"') ? "s" : m[2].includes('t="str"') ? "str" : "",
    v: (m[3].match(/<v>([\s\S]*?)<\/v>/) ?? [])[1] ?? "(kosong)",
  }));
  console.log(`row r=${rn}: ${cells.slice(0, 12).map((c) => `${c.ref}${c.t ? "(" + c.t + ")" : ""}=${String(c.v).slice(0, 28).replace(/\s+/g, " ")}`).join(" | ")}`);
  if (cells.length > 12) console.log(`   ... total ${cells.length} sel, lanjutan: ${cells.slice(12, 45).map((c) => c.ref).join(",")}`);
}
