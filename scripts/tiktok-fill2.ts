/**
 * tiktok-fill2.ts — Isi 12 template resmi TikTok Shop dengan produk top-100.
 *
 * Pendekatan: edit XML sheet Template langsung (bukan via lib xlsx), karena
 * atribut <dimension> template basi (A3:AB6) padahal sheet aslinya 61 kolom
 * (A..BI), dan lib xlsx tidak mempertahankan data validation. Data diisi mulai
 * baris 8 (baris 1-7 = metadata template: config key/value, header, wajib/
 * opsional, instruksi, contoh). Kolom gudang Z..AQ (18 gudang) dipetakan per
 * template dari header baris 3 + sharedStrings.
 *
 * Gambar: webp -> proxy wsrv.nl (output=jpg); URL 404 dibuang dari slot.
 * Berat/dimensi kosong -> default (aksesoris 50g/10x8x2, lain 100g/15x10x3).
 *
 * Jalankan: node scripts/tiktok-fill2.ts
 * Output:  tiktok-upload/t{i}-{kategori}.xlsx + fill2-report.txt
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "tiktok-template", "raw");
const OUT_DIR = path.join(ROOT, "tiktok-upload");
const TOP100 = JSON.parse(fs.readFileSync(path.join(ROOT, "tiktok-export", "top100.json"), "utf8")) as any[];

const TPL_NAMES: Record<string, string> = {
  t1: "Kesehatan", t2: "Pakaian Anak", t3: "Alat & Perangkat Keras",
  t4: "Aksesori Perhiasan", t5: "Ponsel & Elektronik", t6: "Renovasi Rumah",
  t7: "Makanan & Minuman", t8: "Perlengkapan Rumah Tangga", t9: "Perlengkapan Hewan Peliharaan",
  t10: "Otomotif", t11: "Perawatan & Kecantikan", t12: "Olahraga & Outdoor",
};

const BROKEN_URL = "https://anekadropship.id/uploads/products/1769842384_697da6d0e28da.webp";

// ---------------------------------------------------------------------------
// Zip reader/writer minimal (store, no compression) — Node murni
// ---------------------------------------------------------------------------

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const b of buf) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readZip(buf: Buffer): Map<string, Buffer> {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("bukan zip: EOCD tidak ditemukan");
  const count = buf.readUInt16LE(eocd + 10);
  const cdOff = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();
  let p = cdOff;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("central directory rusak");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const lnameLen = buf.readUInt16LE(localOff + 26);
    const lextraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lnameLen + lextraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    out.set(name, method === 8 ? zlib.inflateRawSync(comp) : comp);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function writeZip(entries: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const cd: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // UTF-8
    lh.writeUInt16LE(0, 8); // store
    lh.writeUInt16LE(0, 10); // time
    lh.writeUInt16LE(0x0021, 12); // date 1980-01-01
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(e.data.length, 18);
    lh.writeUInt32LE(e.data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    parts.push(lh, nameBuf, e.data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0x0021, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(e.data.length, 20);
    ch.writeUInt32LE(e.data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    cd.push(ch, nameBuf);
    offset += 30 + nameBuf.length + e.data.length;
  }
  const cdStart = offset;
  const cdBuf = Buffer.concat(cd);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cdBuf, eocd]);
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function colLetter(i: number): string {
  let s = "";
  i = i + 1;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function xmlEsc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r\n|\r|\n/g, "&#10;");
}

function textCell(ref: string, text: string): string {
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(text)}</t></is></c>`;
}

function numCell(ref: string, num: number): string {
  return `<c r="${ref}"><v>${num}</v></c>`;
}

function imgUrl(u: string): string {
  return /\.webp/i.test(u) ? `https://wsrv.nl/?url=${encodeURIComponent(u)}&output=jpg` : u;
}

// Konsolidasi gudang: lokasi asli -> nama gudang (18)
function loadGudangMap(): Map<string, string> {
  const m = new Map<string, string>();
  const csv = fs.readFileSync(path.join(ROOT, "tiktok-export", "warehouse-consolidation.csv"), "utf8");
  for (const line of csv.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split(";");
    if (parts.length >= 2) m.set(parts[0].trim().toLowerCase(), parts[1].trim());
  }
  return m;
}

const GUDANG = loadGudangMap();
function gudangOf(location: string): string {
  const key = (location ?? "").trim().toLowerCase();
  if (!key) return "Gudang Jakarta";
  return GUDANG.get(key) ?? `Gudang ${location.trim()}`;
}

function isJewelry(name: string): boolean {
  return /gelang|kalung|giok|gantungan|aksesoris|batu|perhiasan|pixiu|feng shui|keychain/i.test(name);
}

// ---------------------------------------------------------------------------
// Isi satu template
// ---------------------------------------------------------------------------

interface FillResult {
  tpl: string;
  outFile: string;
  rows: string[];
  report: string[];
}

function fillTemplate(tpl: string, products: any[]): FillResult {
  const rawFile = path.join(RAW_DIR, `${tpl}.zip`);
  const zip = readZip(fs.readFileSync(rawFile));
  const sheetName = [...zip.keys()].find((k) => /worksheets\/sheet1\.xml$/.test(k));
  if (!sheetName) throw new Error(`${tpl}: sheet1.xml tidak ditemukan`);
  const sheetXml0 = zip.get(sheetName)!.toString("utf8");

  const ssXml = [...zip.keys()].find((k) => /sharedStrings\.xml$/.test(k));
  if (!ssXml) throw new Error(`${tpl}: sharedStrings.xml tidak ditemukan`);
  const ss: string[] = [];
  for (const m of zip.get(ssXml)!.toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const parts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]);
    ss.push(
      parts
        .join("")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#160;/g, "\u00a0")
        .replace(/&#10;/g, "\n")
    );
  }

  // Header baris 3 -> nama kolom (kolom A..BI)
  const header = new Map<number, string>();
  for (const m of sheetXml0.matchAll(/<c r="([A-Z]+)3"[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/g)) {
    const idx = parseInt(m[2], 10);
    header.set(colToIdx(m[1]), ss[idx] ?? "");
  }

  function colToIdx(col: string): number {
    let n = 0;
    for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }

  const normName = (s: string) => s.replace(/\u00a0/g, " ").trim();
  // Kolom gudang: nama (dinormalisasi) -> indeks kolom
  const whCol = new Map<string, number>();
  for (const [idx, name] of header) {
    const n = normName(name);
    if (n.startsWith("Jumlah di ")) whCol.set(n.slice("Jumlah di ".length).trim(), idx);
  }

  // Kolom wajib lain
  const findCol = (name: string): number | null => {
    for (const [idx, h] of header) if (normName(h) === name) return idx;
    return null;
  };
  const cCat = findCol("Kategori")!;
  const cName = findCol("Nama produk")!;
  const cDesc = findCol("Deskripsi produk")!;
  const cImg1 = findCol("Gambar utama")!;
  const cWeight = findCol("Berat paket(g)")!;
  const cLen = findCol("Panjang paket(cm)")!;
  const cWid = findCol("Lebar paket(cm)")!;
  const cHei = findCol("Tinggi paket(cm)")!;
  const cPrice = findCol("Harga Ritel (Mata Uang Lokal)")!;
  const cSku = findCol("SKU Penjual")!;
  const cMinBuy = findCol("Pembelian minimum per pesanan");

  const report: string[] = [];
  const rows: string[] = [];

  const sheetXml: string = (() => {
    let xml = sheetXml0;
    products.forEach((p, k) => {
      const rn = 8 + k;
      const cells: string[] = [];
      const ref = (c: number) => `${colLetter(c)}${rn}`;

      cells.push(textCell(ref(cCat), p.categoryCell));

      let name = String(p.name ?? "").slice(0, 255);
      cells.push(textCell(ref(cName), name));

      let desc = String(p.description ?? "");
      if (desc.length > 2000) {
        report.push(`${p.id} | deskripsi dipotong ${desc.length} -> 2000`);
        desc = desc.slice(0, 2000);
      }
      cells.push(textCell(ref(cDesc), desc));

      // Gambar: buang URL mati, webp -> proxy
      const imgs = (p.images as string[]).filter((u) => u !== BROKEN_URL);
      const used: string[] = [];
      for (let i = 0; i < 9 && i < imgs.length; i++) {
        const finalUrl = imgUrl(imgs[i]);
        used.push(finalUrl);
        cells.push(textCell(ref(cImg1 + i), finalUrl));
      }
      if (used.length !== imgs.length) report.push(`${p.id} | gambar > 9 slot: ${imgs.length - used.length} dibuang`);

      // Berat + dimensi
      let wG = p.weightKg != null && p.weightKg > 0 ? Math.round(p.weightKg * 1000) : 0;
      let dims: [number, number, number] | null =
        p.lengthCm != null && p.widthCm != null && p.heightCm != null
          ? [p.lengthCm, p.widthCm, p.heightCm]
          : null;
      if (!wG || !dims) {
        const j = isJewelry(name);
        if (!wG) wG = j ? 50 : 100;
        if (!dims) dims = j ? [10, 8, 2] : [15, 10, 3];
        report.push(`${p.id} | default berat/dimensi: ${wG}g, ${dims.join("x")}cm`);
      }
      cells.push(numCell(ref(cWeight), wG));
      cells.push(numCell(ref(cLen), Math.round(dims[0] * 10) / 10));
      cells.push(numCell(ref(cWid), Math.round(dims[1] * 10) / 10));
      cells.push(numCell(ref(cHei), Math.round(dims[2] * 10) / 10));

      // Harga
      const price = Math.round(p.price ?? 0);
      cells.push(numCell(ref(cPrice), price));

      // Stok ke kolom gudang produk
      const g = gudangOf(p.location);
      const wIdx = whCol.get(g);
      const stock = Math.max(0, Math.round(p.stock ?? 0));
      if (wIdx != null) {
        cells.push(numCell(ref(wIdx), stock));
      } else {
        const fallback = [...whCol.entries()][0];
        cells.push(numCell(ref(fallback[1]), stock));
        report.push(`${p.id} | gudang "${g}" tidak ada di template, stok -> ${fallback[0]}`);
      }

      cells.push(textCell(ref(cSku), String(p.sku ?? p.id)));

      // Injeksi setelah tag buka <row r="N">
      const rowTag = `<row r="${rn}">`;
      if (!xml.includes(rowTag)) throw new Error(`${tpl}: <row r="${rn}"> tidak ditemukan`);
      xml = xml.replace(rowTag, rowTag + cells.join(""));
      rows.push(`${p.id}\t${g}\t${name.slice(0, 50)}\t${imgs.length} gambar`);
    });
    // Perbaiki <dimension> yang basi (template asli A3:AB6) agar mencakup data
    xml = xml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:BI${7 + products.length}"/>`);
    return xml;
  })();

  // Tulis ulang zip (entry sheet1.xml diganti)
  const outEntries = [...zip.entries()].map(([name, data]) =>
    name === sheetName ? { name, data: Buffer.from(sheetXml, "utf8") } : { name, data }
  );
  const outFile = path.join(OUT_DIR, `${tpl}-${TPL_NAMES[tpl] ?? ""}.xlsx`.replace(/[\\/:*?"<>|]/g, "-"));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(outFile, writeZip(outEntries));
  return { tpl, outFile, rows, report };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const groups = new Map<string, any[]>();
  for (const p of TOP100) {
    const t = p.mappedTpl;
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t)!.push(p);
  }
  const allReport: string[] = [];
  const summary: string[] = [];
  for (const [tpl, prods] of groups) {
    const r = fillTemplate(tpl, prods);
    summary.push(`${tpl}\t${prods.length} produk -> ${path.basename(r.outFile)}`);
    if (r.report.length) allReport.push(`--- ${tpl} ---`, ...r.report);
  }
  fs.writeFileSync(
    path.join(OUT_DIR, "fill2-report.txt"),
    ["=== FILE DIHASILKAN ===", ...summary.sort(), "", "=== CATATAN PER PRODUK ===", ...allReport].join("\n")
  );
  console.log("=== FILE DIHASILKAN ===");
  summary.sort().forEach((s) => console.log(" ", s));
  console.log("Total produk:", TOP100.length);
  console.log("Laporan:", path.join(OUT_DIR, "fill2-report.txt"));
}

main();
