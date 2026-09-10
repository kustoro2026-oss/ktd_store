/**
 * tiktok-template-info.ts — Baca 12 template resmi TikTok Shop (hasil unduhan
 * Seller Center) dan hasilkan metadata terpadu:
 *   - kolom Template (nama tampilan) + TemplateConfig (kunci kolom)
 *   - kolom gudang (warehouse_quantity/xxx -> "Jumlah di ...")
 *   - daftar leaf kategori resmi (Category sheet: path -> leaf_id)
 *
 * Jalankan: node scripts/tiktok-template-info.ts
 * Output:   tiktok-export/templates-meta.json
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";

const RAW_DIR = path.resolve("tiktok-template/raw");
const OUT = path.resolve("tiktok-export/templates-meta.json");

const meta: Record<string, any> = {};

for (let i = 1; i <= 12; i++) {
  const file = path.join(RAW_DIR, `t${i}.zip`);
  const wb = XLSX.readFile(file);

  const tpl = XLSX.utils.sheet_to_json(wb.Sheets["Template"], { header: 1 }) as any[][];
  const cfg = XLSX.utils.sheet_to_json(wb.Sheets["TemplateConfig"], { header: 1 }) as any[][];
  const cats = XLSX.utils.sheet_to_json(wb.Sheets["Category"], { header: 1 }) as any[][];
  const style = XLSX.utils.sheet_to_json(wb.Sheets["HiddenStyle"], { header: 1 }) as any[][];
  const attrs = XLSX.utils.sheet_to_json(wb.Sheets["HiddenAttr"], { header: 1 }) as any[][];

  const tplHeader = (tpl[0] || []).map((c: any) => String(c ?? ""));
  const cfgHeader = (cfg[0] || []).map((c: any) => String(c ?? ""));
  const styleHeader = (style[0] || []).map((c: any) => String(c ?? ""));

  // leaf kategori resmi
  const leaves: Record<string, number> = {};
  for (const row of cats.slice(1)) {
    if (row[0] && row[1] != null) leaves[String(row[0]).trim()] = Number(row[1]);
  }

  // kolom gudang: TemplateConfig "warehouse_quantity/{id}" <-> Template "Jumlah di {nama}"
  const whCfg: string[] = [];
  const whTpl: string[] = [];
  cfgHeader.forEach((c: string, idx: number) => {
    if (c.startsWith("warehouse_quantity/")) whCfg.push(c);
  });
  tplHeader.forEach((c: string) => {
    if (c.startsWith("Jumlah di ")) whTpl.push(c.replace("Jumlah di ", ""));
  });

  meta[`t${i}`] = {
    sheets: wb.SheetNames,
    tplHeader,
    cfgHeader,
    styleHeader,
    leavesCount: Object.keys(leaves).length,
    leaves,
    whCfg,
    whTpl,
    whCount: whCfg.length,
    hiddenAttrRows: attrs.length,
  };
}

fs.writeFileSync(OUT, JSON.stringify(meta, null, 2));

// Ringkasan
for (let i = 1; i <= 12; i++) {
  const m = meta[`t${i}`];
  const sample = Object.keys(m.leaves)[0];
  console.log(
    `t${i}: ${m.leavesCount} leaves | ${m.whCount} gudang | cfg ${m.cfgHeader.length} | tpl ${m.tplHeader.length}`,
    "| contoh:", sample
  );
}
console.log("Output:", OUT);
