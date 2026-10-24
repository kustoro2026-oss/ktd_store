// Generator katalog pascabayar (Bayar Tagihan) KTD Store.
//
// Sumber: scripts/_dg-tpl/pasca-pricelist.json — hasil POST /v1/price-list
// (cmd "pasca") akun Digiflazz (snapshot 664 SKU aktif).
// Output: src/lib/topup-pasca.ts (jangan edit manual).
//
// Pemetaan brand Digiflazz → kategori UI:
//   PLN PASCABAYAR / PLN NONTAGLIS → pln
//   PDAM                           → pdam
//   PBB                            → pbb
//   INTERNET PASCABAYAR            → internet
//   TV PASCABAYAR                  → tv
//   HP PASCABAYAR / *Omni/Only4u/CuanMax/Cuanku/by.U → hp
//   BPJS KESEHATAN / KETENAGAKERJAAN → bpjs
//   MULTIFINANCE                   → multifinance
//   GAS NEGARA                     → gas
//   E-MONEY                        → DIKECUALIKAN (inquiry butuh field amount)
//
// Jalankan: node scripts/gen-topup-pasca.cjs

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "_dg-tpl", "pasca-pricelist.json");
const OUT = path.join(__dirname, "..", "src", "lib", "topup-pasca.ts");

const CATEGORIES = [
  { id: "pln", label: "Listrik PLN", desc: "Tagihan listrik pascabayar & nontaglis", targetLabel: "No. Meter / ID Pelanggan" },
  { id: "pdam", label: "PDAM", desc: "Tagihan air seluruh wilayah", targetLabel: "Nomor Pelanggan" },
  { id: "pbb", label: "Pajak PBB", desc: "Pajak bumi & bangunan per kabupaten/kota", targetLabel: "Kode Pembayaran", secondLabel: "Nomor Identitas" },
  { id: "internet", label: "Internet Rumah", desc: "IndiHome, MyRepublic, dll.", targetLabel: "Nomor Pelanggan" },
  { id: "tv", label: "TV & Kabel", desc: "TV berlangganan pascabayar", targetLabel: "Nomor Pelanggan" },
  { id: "hp", label: "Pulsa Pascabayar", desc: "Tagihan HP pascabayar (Halo, Omni, dll.)", targetLabel: "Nomor HP" },
  { id: "bpjs", label: "BPJS", desc: "BPJS Kesehatan & Ketenagakerjaan", targetLabel: "Nomor Peserta" },
  { id: "multifinance", label: "Multifinance", desc: "Cicilan motor/mobil & pembiayaan", targetLabel: "Nomor Kontrak" },
  { id: "gas", label: "Gas Negara", desc: "Tagihan gas PGN", targetLabel: "Nomor Pelanggan" },
];

/** brand Digiflazz → kategori UI. */
function categoryFor(brand) {
  const b = String(brand || "").trim();
  if (b === "PLN PASCABAYAR" || b === "PLN NONTAGLIS") return "pln";
  if (b === "PDAM") return "pdam";
  if (b === "PBB") return "pbb";
  if (b === "INTERNET PASCABAYAR") return "internet";
  if (b === "TV PASCABAYAR") return "tv";
  if (b === "MULTIFINANCE") return "multifinance";
  if (b === "GAS NEGARA") return "gas";
  if (b === "BPJS KESEHATAN" || b === "BPJS KETENAGAKERJAAN") return "bpjs";
  if (
    b === "HP PASCABAYAR" ||
    b === "Telkomsel Omni" ||
    b === "Indosat Only4u" ||
    b === "Tri CuanMax" ||
    b === "XL Axis Cuanku" ||
    b === "by.U"
  ) {
    return "hp";
  }
  return null; // termasuk E-MONEY — dikecualikan v1
}

function main() {
  const j = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const data = Array.isArray(j.data) ? j.data : [];
  const products = [];
  const skipped = [];
  for (const it of data) {
    const sku = String(it.buyer_sku_code || "").trim();
    if (!sku) continue;
    const category = categoryFor(it.brand);
    if (!category) {
      skipped.push({ sku, brand: it.brand, name: it.product_name });
      continue;
    }
    products.push({
      sku,
      name: String(it.product_name || sku),
      brand: String(it.brand || ""),
      category,
      admin: Number(it.admin ?? 0) || 0,
      commission: Number(it.commission ?? 0) || 0,
      desc: String(it.desc ?? ""),
    });
  }
  // Urut: kategori sesuai urutan CATEGORIES, dalamnya nama A→Z.
  const order = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  products.sort(
    (a, b) =>
      (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99) ||
      a.name.localeCompare(b.name, "id"),
  );

  const lines = [];
  lines.push("// Katalog Bayar Tagihan (pascabayar) KTD Store.");
  lines.push("// FILE DIGENERASI OTOMATIS — jangan edit manual.");
  lines.push("// Sumber: price-list Digiflazz cmd \"pasca\" (scripts/_dg-tpl/pasca-pricelist.json).");
  lines.push("// Regenerasi: node scripts/gen-topup-pasca.cjs");
  lines.push("//");
  lines.push("// Harga pelanggan = tagihan + admin (model admin apa adanya, laba dari");
  lines.push("// komisi Digiflazz). E-MONEY tidak disertakan (inquiry butuh field amount).");
  lines.push("");
  lines.push("export type PascaCategoryId =");
  lines.push('  | "pln" | "pdam" | "pbb" | "internet" | "tv" | "hp"');
  lines.push('  | "bpjs" | "multifinance" | "gas";');
  lines.push("");
  lines.push("export interface PascaCategoryInfo {");
  lines.push("  id: PascaCategoryId;");
  lines.push("  label: string;");
  lines.push("  desc: string;");
  lines.push("  targetLabel: string;");
  lines.push("  /** Kolom kedua (PBB: kode pembayaran + nomor identitas, digabung koma). */");
  lines.push("  secondLabel?: string;");
  lines.push("}");
  lines.push("");
  lines.push("export interface PascaProduct {");
  lines.push("  /** buyer_sku_code Digiflazz. */");
  lines.push("  sku: string;");
  lines.push("  /** Nama produk tampilan (mis. \"PDAM Aetra\"). */");
  lines.push("  name: string;");
  lines.push("  /** Brand Digiflazz asli (mis. \"PDAM\"). */");
  lines.push("  brand: string;");
  lines.push("  category: PascaCategoryId;");
  lines.push("  /** Biaya admin dibayar pembeli (Rp). */");
  lines.push("  admin: number;");
  lines.push("  /** Komisi toko dari Digiflazz (Rp) — internal, tidak tampil ke pembeli. */");
  lines.push("  commission: number;");
  lines.push("  /** Deskripsi (wilayah/tipe). */");
  lines.push("  desc: string;");
  lines.push("}");
  lines.push("");
  lines.push("export const PASCA_CATEGORIES: PascaCategoryInfo[] = " +
    JSON.stringify(CATEGORIES.map((c) => ({ id: c.id, label: c.label, desc: c.desc, targetLabel: c.targetLabel, ...(c.secondLabel ? { secondLabel: c.secondLabel } : {}) }))) +
    ";");
  lines.push("");
  lines.push("export const PASCA_PRODUCTS: PascaProduct[] = " +
    JSON.stringify(products.map((p) => ({
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      category: p.category,
      admin: p.admin,
      commission: p.commission,
      desc: p.desc,
    }))) +
    ";");
  lines.push("");
  lines.push("/** Set SKU pasca — dipakai executor membedakan pay-pasca vs topup biasa. */");
  lines.push("export const PASCA_SKUS: ReadonlySet<string> = new Set(PASCA_PRODUCTS.map((p) => p.sku));");
  lines.push("");

  fs.writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log(`OK: ${products.length} produk pasca → ${OUT}`);
  if (skipped.length) {
    console.log(`Dikecualikan (${skipped.length}):`);
    for (const s of skipped.slice(0, 10)) console.log(`  - ${s.brand} | ${s.name}`);
  }
}

main();
