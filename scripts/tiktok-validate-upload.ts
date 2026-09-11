/**
 * Validasi menyeluruh file upload TikTok (KESEHATAN & PAKAIAN-ANAK) sebelum
 * diunggah manual: kolom wajib, panjang nama/deskripsi, URL gambar, varian,
 * kolom tersembunyi (SKU, bagan ukuran, atribut), dan signature template.
 * Jalankan: node scripts/tiktok-validate-upload.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSXNS from "xlsx";
const XLSX: any = (XLSXNS as any).default ?? XLSXNS;

const DIR = path.resolve("tiktok-upload");
const files = [
  "t1-Kesehatan-FIX.xlsx",
  "t2-Pakaian Anak-FIX.xlsx",
  "t3-Alat & Perangkat Keras-FIX.xlsx",
  "t8-Perlengkapan Rumah Tangga-FIX.xlsx",
  "t11-Perawatan & Kecantikan-FIX.xlsx",
  "t9-Perlengkapan Hewan Peliharaan-FIX.xlsx",
  "t12-Olahraga & Outdoor-FIX.xlsx",
  "t7-Makanan & Minuman-V2.xlsx",
];

const problems: string[] = [];
const warn = (f: string, rowNo: number, msg: string) => problems.push(`[${f} baris ${rowNo}] ${msg}`);

const URL_RE = /^https?:\/\//i;
const ALLOWED_HOSTS = new Set(["anekadropship.id", "toko.kustoro2026.com"]);

function checkImg(f: string, rowNo: number, cell: unknown, label: string, optional = false) {
  const s = String(cell ?? "").trim();
  if (!s) {
    if (!optional) warn(f, rowNo, `${label} kosong`);
    return;
  }
  if (!URL_RE.test(s)) {
    warn(f, rowNo, `${label} bukan URL: ${s.slice(0, 80)}`);
    return;
  }
  try {
    const host = new URL(s).hostname.replace(/^www\./, "");
    if (!ALLOWED_HOSTS.has(host)) warn(f, rowNo, `${label} host tidak dikenal: ${host} (${s.slice(0, 80)})`);
  } catch {
    warn(f, rowNo, `${label} URL invalid: ${s.slice(0, 80)}`);
  }
}

for (const f of files) {
  const fp = path.join(DIR, f);
  const wb = XLSX.readFile(fp);
  const ws = wb.Sheets["Template"];
  const a1 = ws["A1"]?.v;
  const a2 = ws["A2"]?.v;
  if (a1 !== "category" || a2 !== "V5.0.2") {
    warn(f, 0, `Signature template hilang/berubah: A1=${JSON.stringify(a1)} A2=${JSON.stringify(a2)}`);
  }
  const t: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  console.log(`\n=== ${f}: ${t.length - 5} baris data (total ${t.length})`);

  const isPakaian = f.includes("PAKAIAN");
  const skus = new Set<string>();
  const names = new Set<string>();

  for (let r = 5; r < t.length; r++) {
    const rowNo = r + 1;
    const row = t[r];
    const kategori = String(row[0] ?? "").trim();
    const nama = String(row[2] ?? "").trim();
    const deskripsi = String(row[3] ?? "").trim();
    const berat = Number(row[18] ?? 0);
    const len = Number(row[19] ?? 0);
    const wid = Number(row[20] ?? 0);
    const hei = Number(row[21] ?? 0);
    const harga = Number(row[23] ?? 0);
    const stok = [];
    const stokCells = [];
    for (let w = 25; w <= 42; w++) {
      const v = row[w];
      stok.push(Number(v ?? 0) > 0 ? Number(v) : 0);
      if (String(v ?? "").trim() !== "") stokCells.push(v);
    }
    const vNama1 = String(row[13] ?? "").trim();
    const vNilai1 = String(row[14] ?? "").trim();
    const vNama2 = String(row[16] ?? "").trim();
    const vNilai2 = String(row[17] ?? "").trim();

    // Kolom wajib umum
    if (!kategori) warn(f, rowNo, "Kategori kosong");
    if (!nama) warn(f, rowNo, "Nama produk kosong");
    else if (nama.length < 25) warn(f, rowNo, `Nama terlalu pendek (${nama.length} < 25): ${nama.slice(0, 40)}`);
    else if (nama.length > 255) warn(f, rowNo, `Nama > 255 char (${nama.length})`);
    if (!deskripsi) warn(f, rowNo, "Deskripsi kosong");
    else if (deskripsi.length > 2000) warn(f, rowNo, `Deskripsi > 2000 char (${deskripsi.length})`);
    if (berat <= 0) warn(f, rowNo, "Berat paket <= 0");
    if (len <= 0 || wid <= 0 || hei <= 0) warn(f, rowNo, `Dimensi tidak valid (${len}x${wid}x${hei})`);
    if (!(harga > 0)) warn(f, rowNo, `Harga tidak valid: ${JSON.stringify(row[23])}`);
    if (stokCells.length === 0) warn(f, rowNo, "Semua gudang stok kosong/0");
    if (vNama1 && !vNilai1) warn(f, rowNo, "Nama varian utama terisi tapi nilai kosong");
    if (!vNama1 && vNilai1) warn(f, rowNo, "Nilai varian utama terisi tapi nama kosong");
    if (vNama2 && !vNilai2) warn(f, rowNo, "Nama varian sekunder terisi tapi nilai kosong");
    if (vNama1 && vNama1.length > 20) warn(f, rowNo, `Nama varian > 20 char (${vNama1.length})`);
    if (vNilai1 && vNilai1.length > 50) warn(f, rowNo, `Nilai varian > 50 char (${vNilai1.length})`);
    if (vNilai2 && vNilai2.length > 50) warn(f, rowNo, `Nilai varian 2 > 50 char (${vNilai2.length})`);

    // Gambar 1-9
    for (let i = 0; i < 9; i++) {
      checkImg(f, rowNo, row[4 + i], `Gambar ${i + 1}`, i > 0);
    }

    // Atribut tersembunyi untuk kategori Pembersih Rumah Tangga:
    // kolom 57 = product_property/101734 "Contains dangerous goods?"
    // (wajib untuk beberapa subkategori; "Anti Ngengat" = Forbid).
    if (f.includes("RUMAH")) {
      const dg = String(row[57] ?? "").trim();
      const perluDG = [
        "Semprotan, Cairan, dan Tisu Disinfektan",
        "Pembuka Saluran",
        "Pembersih Toilet",
        "Pembersih Kerak",
        "Pembersih Kamar Mandi",
        "Penghilang Jamur",
      ].some((k) => kategori.endsWith(k));
      if (perluDG && dg !== "Ya" && dg !== "Tidak")
        warn(f, rowNo, `Atribut Contains dangerous goods? (kolom 58) harus Ya/Tidak: "${dg}"`);
      if (!perluDG && dg) warn(f, rowNo, `Atribut Contains dangerous goods? terisi padahal kategori melarang: "${dg}"`);
    }

    // Kategori kecantikan:
    // - Perangkat Kecantikan Tubuh wajib garansi (kolom 47 = 100107).
    // - Kategori wajib Nomor Ijin Edar BPOM (kolom 58 = 101066) TIDAK boleh
    //   ada di file bulk tanpa nomor.
    if (f.includes("Kecantikan")) {
      if (kategori.endsWith("Peralatan Perawatan/Perangkat Kecantikan Tubuh")) {
        if (!String(row[47] ?? "").trim()) warn(f, rowNo, "Garansi (kolom 47) kosong - wajib utk Perangkat Kecantikan Tubuh");
      }
      const perluBPOM = [
        "Perawatan Kulit/Moisturiser & Mist",
        "Keperluan Mandi & Perawatan Tubuh/Cream & Lotion Tubuh",
      ].some((k) => kategori.endsWith(k));
      if (perluBPOM) warn(f, rowNo, `Kategori wajib Nomor Ijin Edar BPOM (kolom 58) tapi kolom kosong: ${kategori.slice(-40)}`);
    }

    // Makanan: kategori Cuka wajib Jenis Sertifikasi (kolom 58 = 101084).
    if (f.includes("Makanan")) {
      const sert = String(row[58] ?? "").trim();
      if (kategori.startsWith("Bahan Makanan & Peralatan Memasak Pokok/Cuka") && !sert) {
        warn(f, rowNo, "Jenis Sertifikasi (kolom 59) kosong - wajib utk kategori Cuka");
      }
    }

    if (isPakaian) {
      const sku = String(row[43] ?? "").trim();
      const bagan = String(row[45] ?? "").trim();
      if (!sku) warn(f, rowNo, "SKU (kolom 43) kosong");
      else {
        if (skus.has(sku)) warn(f, rowNo, `SKU duplikat: ${sku}`);
        skus.add(sku);
      }
      if (!bagan) warn(f, rowNo, "Bagan Ukuran (kolom 45) kosong - wajib utk pakaian");
      else if (!URL_RE.test(bagan)) warn(f, rowNo, `Bagan Ukuran bukan URL: ${bagan.slice(0, 80)}`);
      for (const c of [47, 48, 49, 50, 51, 52]) {
        if (!String(row[c] ?? "").trim()) warn(f, rowNo, `Atribut kolom ${c + 1} kosong`);
      }
    }
    names.add(nama);
  }
  console.log(`  produk unik: ${names.size} | SKU unik: ${skus.size}`);
}

if (problems.length) {
  console.log(`\nMASALAH DITEMUKAN: ${problems.length}`);
  problems.slice(0, 50).forEach((p) => console.log(" ", p));
  if (problems.length > 50) console.log(`  ... dan ${problems.length - 50} lainnya`);
} else {
  console.log("\nSEMUA VALIDASI LEWAT - file siap upload.");
}
