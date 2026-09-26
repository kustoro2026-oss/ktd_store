/**
 * build-evermos-export.cjs — Olah hasil scrape Evermos menjadi file export ala anekadropship.
 *
 * Input : evermos-scrape/evermos-products.json (+ evermos-scrape/evermos-categories.json)
 * Output: evermos-export/products-cache.json     — produk (id EVM-<modelId>, harga, stok, kategori, url)
 *         evermos-export/variant-cache.json      — varian per produk
 *         evermos-export/description-cache.json  — deskripsi per produk
 *
 * Format nilai sengaja disamakan dengan cache anekadropship:
 *   rekomendasiJual "Rp 200.000" (spasi), hargaModal "Rp160.000" (tanpa spasi),
 *   terjual "7,7rb"/"1,2jt", profit "Profit +25%", stok string, volume "P x L x T CM".
 *
 * CATATAN HARGA (26 Sep 2026): rekomendasiJual diambil dari customerPrice Evermos
 * (harga jual aktual ke konsumen setelah diskon platform) — BUKAN retailPrice,
 * yang merupakan harga coret sebelum diskon dan sering jauh lebih tinggi.
 * Bukti: commissionPrice Evermos = customerPrice - resellerPrice (konsisten di
 * 98% produk ber-detail). Sumber detail diutamakan (konsisten internal); list
 * hanya fallback karena customerPrice list kadang salah (mis. < resellerPrice).
 *
 * Pakai: node scripts/build-evermos-export.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RAW_FILE = path.join(ROOT, "evermos-scrape", "evermos-products.json");
const CATS_FILE = path.join(ROOT, "evermos-scrape", "evermos-categories.json");
const OUT_DIR = path.join(ROOT, "evermos-export");

function fmtRpNum(n) {
  if (typeof n !== "number" || !isFinite(n) || n <= 0) return "";
  return n.toLocaleString("id-ID");
}
function rp(n) {
  const v = fmtRpNum(n);
  return v ? "Rp" + v : "";
}
function rpSpace(n) {
  const v = fmtRpNum(n);
  return v ? "Rp " + v : "";
}
function fmtSold(n) {
  if (typeof n !== "number" || !isFinite(n) || n <= 0) return "0";
  if (n >= 1000000) return String(Math.round(n / 100000) / 10).replace(".", ",") + "jt";
  if (n >= 1000) return String(Math.round(n / 100) / 10).replace(".", ",") + "rb";
  return String(n);
}
function dims(v) {
  if (!v) return "";
  const l = Number(v.length) || 0;
  const w = Number(v.width) || 0;
  const h = Number(v.height) || 0;
  if (l <= 0 && w <= 0 && h <= 0) return "";
  return l + " x " + w + " x " + h + " CM";
}
/**
 * Parse label harga Evermos (mis. "Rp22.306", "Rp248rb", "Rp1,2jt") -> angka.
 * Dipakai sebagai komisi per item pada koreksi harga tanpa data detail.
 */
function parseRpLabel(s) {
  const t = String(s || "").toLowerCase().replace(/\s/g, "");
  const m = t.match(/rp([\d.,]+(?:rb|jt)?)/);
  if (!m) return 0;
  let num = m[1];
  let mult = 1;
  if (num.endsWith("jt")) { mult = 1000000; num = num.slice(0, -2); }
  else if (num.endsWith("rb")) { mult = 1000; num = num.slice(0, -2); }
  if (num.includes(",")) num = num.replace(/\./g, "").replace(",", ".");
  else num = num.replace(/\./g, "");
  const v = Number(num);
  return isFinite(v) ? Math.round(v * mult) : 0;
}

function main() {
  console.log("[build] baca " + RAW_FILE);
  const raw = JSON.parse(fs.readFileSync(RAW_FILE, "utf8"));
  const products = raw.products || [];
  let cats = [];
  try {
    cats = (JSON.parse(fs.readFileSync(CATS_FILE, "utf8")).data) || [];
  } catch (e) {
    console.warn("[build] kategori dilewati: " + e.message);
  }

  const list = [];
  const vMap = {};
  const dMap = {};
  let withVariants = 0;
  let totalVariants = 0;
  let withDescription = 0;
  let emptyDescs = 0;
  let totalChars = 0;

  for (const p of products) {
    const d = p.detail || {};
    const variants = d.variants || [];
    const lv = d.labelVariant || "";
    const ls = d.labelSubVariant || "";

    // Harga jual = customerPrice (harga aktual ke konsumen), bukan retailPrice
    // (harga coret pra-diskon). Detail diutamakan; list hanya fallback.
    let jual =
      Number(d.customerPrice) || Number(p.customerPrice) ||
      Number(d.retailPrice) || Number(p.retailPrice) || 0;
    const modal = Number(d.resellerPriceMin) || Number(p.resellerPrice) || 0;
    // Data list kadang rusak: customerPrice < resellerPrice (tanpa detail tidak
    // ada sumber lain). Rekonstruksi harga jual = modal + komisi per item —
    // terverifikasi menghasilkan angka bulat konsisten (mis. 2208294+22306).
    if (jual > 0 && modal > 0 && jual < modal) {
      const commAmt = parseRpLabel(p.commissionAmountLabel);
      if (commAmt > 0) jual = modal + commAmt;
    }
    const normal = Number(p.normalResellerPrice) || 0;

    const cut = normal > modal && modal > 0 ? rp(normal) : "";
    const base = normal > modal ? normal : modal;
    let profit = "";
    if (jual > 0 && base > 0) {
      const pct = Math.round(((jual - base) / base) * 100);
      if (pct > 0) profit = "Profit +" + pct + "%";
    }

    const sold = typeof d.sold === "number" ? d.sold : 0;
    const stock = typeof d.stock === "number" ? d.stock : typeof p.stock === "number" ? p.stock : 0;
    const code = p.code || "EVM-" + p.modelId;

    list.push({
      id: code,
      modelId: p.modelId,
      marketplace: "evermos",
      name: p.name || "",
      slug: p.slug || "",
      url: p.evermosUrl || "https://evermos.com/view?modelSlug=" + encodeURIComponent(p.slug || "") + "&modelId=" + p.modelId,
      image: p.coverImage || "",
      imageRemote: p.coverImage || "",
      location: d.warehouseAddress || "",
      rekomendasiJual: rpSpace(jual),
      hargaModal: rp(modal),
      hargaModalCut: cut,
      terjual: fmtSold(sold),
      stok: String(stock),
      profit: profit,
      category: d.categoryName || p.category || "",
      categoryLevel2: d.categoryLevel2Name || p.categoryLevel2 || "",
      categoryLevel1: d.categoryLevel1Name || p.categoryLevel1 || "",
      brand: p.brand || d.brandName || "",
      rating: typeof d.rating === "number" ? d.rating : 0,
      hasVariants: variants.length > 0,
      detailStatus: p.detailStatus || "missing",
      beratGram: Number(d.weight) || 0,
      berat: d.weightLabel || "",
      alamatSeller: d.warehouseTitle || "",
      ekspedisi: "",
      ekspedisiList: [],
      volume: variants.length ? dims(variants[0]) : ""
    });

    if (variants.length > 0) {
      withVariants += 1;
      totalVariants += variants.length;
      vMap[code] = {
        hasVariants: true,
        labelVariant: lv,
        labelSubVariant: ls,
        variants: variants.map(function (v) {
          const st = typeof v.stock === "number" ? v.stock : 0;
          return {
            id: v.id,
            name: v.value || v.name || "",
            color: /warna|color/i.test(lv) ? v.value || "" : null,
            size: /ukuran|size/i.test(ls) ? v.defaultSubVariantValue || "" : null,
            stock: st,
            isActive: st > 0,
            sku: v.code || "",
            hargaModal: rp(Number(v.resellerPrice) || 0),
            rekomendasiJual: rpSpace(Number(v.customerPrice) || Number(v.retailPrice) || 0),
            subVariant: v.defaultSubVariantValue || "",
            weightLabel: v.weightLabel || "",
            image: (v.images && v.images[0]) || ""
          };
        })
      };
    } else {
      vMap[code] = { hasVariants: false, labelVariant: lv, labelSubVariant: ls, variants: [] };
    }

    const desc = typeof d.description === "string" ? d.description : "";
    if (desc.trim() === "") emptyDescs += 1;
    else {
      withDescription += 1;
      totalChars += desc.length;
    }
    dMap[code] = desc;
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();

  fs.writeFileSync(
    path.join(OUT_DIR, "products-cache.json"),
    JSON.stringify({
      generatedAt: generatedAt,
      marketplace: "evermos",
      codePrefix: "EVM",
      source: "evermos-scrape/evermos-products.json",
      sourceUrl: "https://evermos.com/browse",
      categories: cats.map(function (c) {
        return { id: c.id, name: c.name, slug: c.category || "" };
      }),
      count: list.length,
      products: list
    })
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "variant-cache.json"),
    JSON.stringify({
      generatedAt: generatedAt,
      marketplace: "evermos",
      scanned: list.length,
      withVariants: withVariants,
      totalVariants: totalVariants,
      products: vMap
    })
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "description-cache.json"),
    JSON.stringify({
      generatedAt: generatedAt,
      marketplace: "evermos",
      scanned: list.length,
      withDescription: withDescription,
      empty: emptyDescs,
      totalChars: totalChars,
      products: dMap
    })
  );

  console.log("[build] selesai:");
  console.log("  products     : " + list.length);
  console.log("  withVariants : " + withVariants + " (" + totalVariants + " varian)");
  console.log("  deskripsi    : " + withDescription + " terisi, " + emptyDescs + " kosong, " + totalChars + " karakter");
}

main();
