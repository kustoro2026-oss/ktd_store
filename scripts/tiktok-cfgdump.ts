/**
 * tiktok-cfgdump.ts — Dump lengkap sheet TemplateConfig t1 + t8 (semua baris).
 * Untuk memahami mapping warehouse_quantity/{id} -> kolom Template.
 * Jalankan: node scripts/tiktok-cfgdump.ts
 */
import * as path from "node:path";
import * as XLSXNS from "xlsx";
const XLSX: typeof XLSXNS = (XLSXNS as any).default ?? XLSXNS;

for (const name of ["t1", "t8"]) {
  const wb = XLSX.readFile(path.resolve(`tiktok-template/raw/${name}.zip`));
  const cfg = XLSX.utils.sheet_to_json(wb.Sheets["TemplateConfig"], { header: 1, defval: "" }) as any[][];
  const hdr = cfg[0].map((c: any) => String(c));
  console.log(`\n########## ${name}: TemplateConfig ${cfg.length} baris x ${hdr.length} kolom ##########`);
  for (let r = 1; r < cfg.length; r++) {
    console.log(`--- baris ${r} ---`);
    cfg[r].forEach((v: any, i: number) => {
      const s = String(v);
      if (s !== "" && hdr[i] !== "") console.log(`  ${hdr[i]} = ${JSON.stringify(s)}`.slice(0, 150));
    });
  }
}
