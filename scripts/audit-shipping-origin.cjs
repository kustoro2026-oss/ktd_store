// Audit: apakah semua produk katalog (aneka + Evermos) cocok dengan alamat
// pengirimnya saat perhitungan ongkir. Meniru resolusi src/lib/origin-resolver.ts:
// byProductId -> byAddress(alamatSeller) -> byLocation(location) -> fallback env
// KIRIMINAJA_ORIGIN_DISTRICT. Sekaligus cek kelengkapan berat & daftar ekspedisi.
// Jalankan: node scripts/audit-shipping-origin.cjs
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

const anekaRaw = read("src/lib/products-cache.json");
const evmRaw = read("src/lib/evermos-products-cache.json");
const origins = read("src/lib/seller-origins.json");
const cityDefaults = read("src/lib/city-origin-defaults.json");

const aneka = anekaRaw.products ?? anekaRaw;
const evm = evmRaw.products ?? evmRaw;

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function resolveProduct(p) {
  if (p.id && origins.byProductId?.[p.id])
    return { source: "produk", district: origins.byProductId[p.id] };
  const ka = norm(p.alamatSeller);
  if (ka && origins.byAddress?.[ka])
    return { source: "alamat", district: origins.byAddress[ka] };
  const kl = norm(p.location);
  if (kl && origins.byLocation?.[kl])
    return { source: "kota", district: origins.byLocation[kl] };
  if (kl && cityDefaults[kl])
    return { source: "kota-default", district: cityDefaults[kl] };
  return { source: "fallback", district: null };
}

function top(map, n) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `    ${String(v).padStart(5)}x  ${k}`)
    .join("\n");
}

const sum = { total: 0, produk: 0, alamat: 0, kota: 0, "kota-default": 0, fallback: 0 };

function audit(label, products) {
  const st = { total: products.length, produk: 0, alamat: 0, kota: 0, "kota-default": 0, fallback: 0 };
  const fbLoc = new Map();
  const fbAddr = new Map();
  const dist = new Map();
  const locSet = new Map();
  let wOk = 0,
    wZero = 0,
    wEmpty = 0,
    aEmpty = 0,
    lEmpty = 0,
    eOk = 0,
    eEmpty = 0,
    fbStokPos = 0;

  for (const p of products) {
    const r = resolveProduct(p);
    st[r.source]++;

    const loc = String(p.location ?? "").trim();
    const addr = String(p.alamatSeller ?? "").trim();
    if (!loc) lEmpty++;
    if (!addr) aEmpty++;
    locSet.set(loc || "(kosong)", (locSet.get(loc || "(kosong)") ?? 0) + 1);

    if (r.source === "fallback") {
      fbLoc.set(loc || "(kosong)", (fbLoc.get(loc || "(kosong)") ?? 0) + 1);
      fbAddr.set(addr || "(kosong)", (fbAddr.get(addr || "(kosong)") ?? 0) + 1);
      const stok = Number(String(p.stok ?? "0").replace(/\D/g, "")) || 0;
      if (stok > 0) fbStokPos++;
    } else {
      const key = `${r.source} -> district ${r.district}`;
      dist.set(key, (dist.get(key) ?? 0) + 1);
    }

    const w = Number(p.beratGram);
    if (p.beratGram === undefined || p.beratGram === null || p.beratGram === "") wEmpty++;
    else if (!(w > 0)) wZero++;
    else wOk++;

    const eLen = Array.isArray(p.ekspedisiList) ? p.ekspedisiList.length : 0;
    if (eLen > 0) eOk++;
    else eEmpty++;
  }

  sum.total += st.total;
  sum.produk += st.produk;
  sum.alamat += st.alamat;
  sum.kota += st.kota;
  sum["kota-default"] += st["kota-default"];
  sum.fallback += st.fallback;

  const L = [];
  L.push(`── ${label}: ${st.total} produk ─────────────────────────`);
  L.push(
    `  Origin: produk=${st.produk}  alamat=${st.alamat}  kota=${st.kota}  default-kota=${st["kota-default"]}  FALLBACK=${st.fallback}`
  );
  L.push(`  Berat : ada=${wOk}  nol=${wZero}  kosong=${wEmpty}`);
  L.push(`  EkspedisiList: terisi=${eOk}  kosong=${eEmpty}`);
  L.push(`  Kosong: location=${lEmpty}  alamatSeller=${aEmpty}`);
  if (dist.size) {
    L.push(`  Sebaran origin teresolusi (top 12):`);
    L.push(top(dist, 12));
  }
  if (st.fallback) {
    L.push(`  FALLBACK lokasi (top 15):`);
    L.push(top(fbLoc, 15));
    L.push(`  FALLBACK alamat (top 10):`);
    L.push(top(fbAddr, 10));
    L.push(`  FALLBACK stok>0: ${fbStokPos}`);
  }
  L.push(`  Semua nilai location (top 20):`);
  L.push(top(locSet, 20));
  return L.join("\n");
}

const out = [];
out.push(`Audit origin pengiriman — ${new Date().toISOString()}`);
out.push("");
out.push(audit("Aneka (products-cache.json)", aneka));
out.push("");
out.push(audit("Evermos (evermos-products-cache.json)", evm));
out.push("");
out.push("── TOTAL katalog gabungan ─────────────────────────");
out.push(
  `  ${sum.total} produk: produk=${sum.produk} alamat=${sum.alamat} kota=${sum.kota} default-kota=${sum["kota-default"]} FALLBACK gudang KTD(env)=${sum.fallback}`
);
out.push("");

const report = out.join("\n");
console.log(report);
fs.writeFileSync(path.join(ROOT, "tiktok-export", "origin-audit-report.txt"), report, "utf8");
console.log("Laporan disimpan: tiktok-export/origin-audit-report.txt");
