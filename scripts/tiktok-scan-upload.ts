/**
 * Scan semua file xlsx di tiktok-upload untuk URL proxy (wsrv.nl dkk) yang
 * ditolak TikTok, plus cek umum kelayakan upload.
 * Jalankan: node scripts/tiktok-scan-upload.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSXNS from "xlsx";
const XLSX: any = (XLSXNS as any).default ?? XLSXNS;

const DIR = path.resolve("tiktok-upload");
const PROXY_RE = /(wsrv\.nl|images\.weserv\.nl|wsrv|weserv)/i;

const files = fs
  .readdirSync(DIR)
  .filter((f) => f.toLowerCase().endsWith(".xlsx"))
  .sort();

let totalProxyCells = 0;

for (const f of files) {
  const fp = path.join(DIR, f);
  let wb: any;
  try {
    wb = XLSX.readFile(fp);
  } catch (e) {
    console.log(`\n=== ${f} : GAGAL DIBACA (${e instanceof Error ? e.message : e})`);
    continue;
  }
  const hits: string[] = [];
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    rows.forEach((row: any[], r: number) => {
      (row ?? []).forEach((cell: any, c: number) => {
        const s = String(cell ?? "");
        if (PROXY_RE.test(s)) {
          hits.push(`  [${sn}!${XLSX.utils.encode_cell({ r, c })}] ${s.slice(0, 120)}`);
        }
      });
    });
  }
  totalProxyCells += hits.length;
  const status = hits.length ? `PROXY-DITEMUKAN (${hits.length})` : "bersih";
  console.log(`\n=== ${f} : ${status}`);
  hits.slice(0, 10).forEach((h) => console.log(h));
  if (hits.length > 10) console.log(`  ... dan ${hits.length - 10} lainnya`);
}

console.log(`\nTotal sel berisi URL proxy: ${totalProxyCells}`);

// Cek juga file lama di tiktok-export
const EXTRA = ["tiktok-export/TIKTOK-UPLOAD.xlsx"];
for (const rel of EXTRA) {
  const fp = path.resolve(rel);
  if (!fs.existsSync(fp)) continue;
  const wb = XLSX.readFile(fp);
  let n = 0;
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    rows.forEach((row: any[]) => (row ?? []).forEach((cell: any) => {
      if (PROXY_RE.test(String(cell ?? ""))) n++;
    }));
  }
  console.log(`\n=== ${rel} : ${n ? `PROXY-DITEMUKAN (${n})` : "bersih"}`);
}
