// Cek: kiriminaja.ts (kode produksi) mengirim XFF dari env.
import * as fs from "node:fs";
import * as path from "node:path";

for (const line of fs.readFileSync(path.resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/\$\\/g, "$");
}
console.log("BASE:", process.env.KIRIMINAJA_BASE_URL);
console.log("XFF :", process.env.KIRIMINAJA_XFF_IP);

async function main() {
  const { getProvinces } = await import("../src/lib/kiriminaja.ts");
  try {
    const p = await getProvinces();
    console.log("SUKSES — jumlah provinsi:", p.length);
  } catch (e) {
    console.log("ERROR:", e instanceof Error ? e.message : e);
  }
}
void main();
