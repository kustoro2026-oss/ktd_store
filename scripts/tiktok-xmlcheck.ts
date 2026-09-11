// tiktok-xmlcheck.ts — periksa kolom gudang di sheet1.xml (Template) t1
import * as fs from "node:fs";
const s = fs.readFileSync("tiktok-template/x1tmp/xl/worksheets/sheet1.xml", "utf8");

const dim = s.match(/<dimension[^>]*>/)?.[0];
console.log("dimension:", dim);

const row1 = s.match(/<row[^>]*r="1"[^>]*>[\s\S]*?<\/row>/)?.[0] ?? "";
console.log("panjang row1:", row1.length);
const cells = [...row1.matchAll(/<c r="([A-Z]+)1"/g)].map((m) => m[1]);
console.log("jumlah sel baris 1:", cells.length);
console.log("sel:", cells.join(","));

// hidden cols
const hidden = s.match(/<col[^>]*hidden="1"[^>]*>/g) ?? [];
console.log("kolom hidden:", hidden.length);
const hiddenRanges = hidden.map((h) => h.match(/min="(\d+)"[^>]*max="(\d+)"/)?.slice(1).join("-")).join(" , ");
console.log("hidden ranges:", hiddenRanges);

// posisi shared string index header gudang: cek row 0 cells dengan t="s" (shared string)
const row0 = s.match(/<row[^>]*r="1"[^>]*>[\s\S]*?<\/row>/)?.[0] ?? "";
const ssCells = [...row0.matchAll(/<c r="([A-Z]+)1"[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/g)].map((m) => `${m[1]}=${m[2]}`);
console.log("sel shared-string baris 1:", ssCells.slice(0, 60).join(","));
