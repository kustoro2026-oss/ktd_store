/**
 * build-evermos-site-data.cjs — Ubah evermos-export/*.json menjadi format cache SITUS
 * (siap dikonsumsi src/lib seperti cache anekadropship), dengan kategori Evermos
 * dipetakan ke 34 kategori situs.
 *
 * Input : evermos-export/products-cache.json (+ variant-cache.json, description-cache.json)
 *         src/lib/products-cache.json (daftar kategori kanonik situs)
 * Output: src/lib/evermos-products-cache.json     — produk EVM-<modelId> bentuk AnekaProduct
 *         src/lib/evermos-variant-cache.json      — varian (bentuk variant-cache situs)
 *         src/lib/evermos-description-cache.json  — deskripsi teks -> HTML siap render
 *         evermos-export/_site-map-report.txt     — laporan pemetaan kategori (audit)
 *
 * Pakai: node scripts/build-evermos-site-data.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const EXPORT_DIR = path.join(ROOT, "evermos-export");
const SRC_LIB = path.join(ROOT, "src", "lib");

const siteCats = (JSON.parse(fs.readFileSync(path.join(SRC_LIB, "products-cache.json"), "utf8")).categories || []);
const SITE_CAT_NAMES = new Set(siteCats.map((c) => c.name));

/** Level-1 Evermos yang bukan produk fisik (donasi, membership, training). */
const EXCLUDED_L1 = [
  "Donasi",
  "Community, Training & onboarding",
  "Member",
  "Member KRS",
  "Travel muslim",
  "?",
];

/**
 * Aturan pemetaan kategori, URUT (first-match-wins).
 * t = { l1, l2, leaf, name, cat, all } — `cat` = l1+l2+leaf (tanpa nama produk,
 * untuk aturan yang rawan salah cocok dari kata di nama produk).
 * Alasan urutan penting: Elektronik sebelum Aksesoris (Casing/Jam HP), bedding
 * sebelum rumah tangga, Personal Care (wewangian/kosmetik) sebelum Kecantikan, dll.
 */
const RULES = [
  { site: "Pencahayaan", test: (t) => /lampu|lighting/i.test(t.all) },
  {
    site: "ELEKTRONIK",
    test: (t) =>
      t.l1 === "Elektronik" ||
      /handphone|smartphone|android|laptop|komputer|elektronik|casing|charger|powerbank|speaker|headset|earphone|televisi|\btv\b|kulkas|mesin cuci|setrika|kipas|jam digital|kamera|cctv|router/i.test(
        t.all,
      ),
  },
  {
    site: "UNDERWEAR",
    test: (t) => /underwear|celana dalam|\bbra\b|panties|korset|singlet|dalam wanita|dalam pria|boxer/i.test(t.all),
  },
  // Uji dari t.cat (bukan nama produk) supaya "Sepatu Sandal Wanita" tetap Sepatu wanita.
  { site: "Sandal Flat Wanita", test: (t) => /sandal/i.test(t.cat) && /wanita|perempuan/i.test(t.cat) },
  {
    site: "Sepatu wanita",
    test: (t) => /sepatu|sneakers|flatshoe/i.test(t.cat) && /wanita|perempuan/i.test(t.cat),
  },
  {
    site: "Selimut & Bedong",
    test: (t) => /sprei|bed ?cover|bedcover|kasur|selimut|bantal|guling|matras|bedong/i.test(t.leaf) || t.l2 === "Kamar Tidur",
  },
  {
    site: "Alat Rumah Tangga",
    test: (t) => t.l1 === "Dapur" || /peralatan masak|perkakas|panci|wajan|pisau|kompor|alat rumah tangga/i.test(t.all),
  },
  {
    site: "AKSESORIS",
    test: (t) =>
      /\btas\b|dompet|jam tangan|kacamata|topi|ikat pinggang|syal|gelang|kalung|anting|cincin|bros|aksesoris/i.test(
        t.all,
      ),
  },
  { site: "Herbal", test: (t) => /madu|herbal|jamu|propolis|habbat/i.test(t.all) },
  {
    site: "Kesehatan",
    test: (t) => t.l1 === "Kesehatan" || /vitamin|suplemen|obat|kesehatan|nutrisi|alkes|tensimeter/i.test(t.all),
  },
  // Personal Care sebelum Kecantikan: Body Lotion dkk ber-L1 "Personal Care"
  // (L2-nya bisa "Perawatan Kulit") supaya tidak jatuh ke Kecantikan.
  {
    site: "wewangian atau kosmetik dan perawatan",
    test: (t) =>
      t.l1 === "Personal Care" ||
      /personal care|parfum|wewangian|sabun|body lotion|body wash|shampoo|perawatan rambut|kewanitaan|deodorant|pasta gigi|sikat gigi/i.test(
        t.all,
      ),
  },
  {
    site: "Kecantikan",
    test: (t) =>
      t.l1 === "Kecantikan" ||
      /kecantikan|perawatan wajah|perawatan kulit|serum|makeup|lip color|lip care|eyeshadow|mascara|foundation|bedak|skincare|krim|toner|cleanser/i.test(
        t.all,
      ),
  },
  {
    site: "Makanan & Minuman",
    test: (t) =>
      ["Makanan", "Minuman", "Beras Sembako"].includes(t.l1) ||
      (/snack|makanan|minuman|\bsusu\b|mie|beras|kue|keripik|kacang|buah|kopi|teh|saus|bumbu|sereal|telur|daging|ikan|ayam|pasta/i.test(
        t.all,
      ) &&
        !/\bbotol\b|pompa asi/i.test(t.all)),
  },
  { site: "MAINAN", test: (t) => /mainan|toys|puzzle|figur/i.test(t.all) },
  {
    site: "Hobi",
    test: (t) => t.l1 === "Stationery & Craft" || /stationery|craft|pernak|hadiah|hobi/i.test(t.all),
  },
  {
    site: "Fashion",
    test: (t) =>
      ["Fashion Dewasa", "Fashion Muslim"].includes(t.l1) ||
      /busana|pakaian|baju|gamis|batik|koko|jilbab|pashmina|khimar|abaya|tunik|dress|kaos|kemeja|blouse|atasan|bawahan|rok|celana|jaket|hoodie|sweater|cardigan|kain|sarung|mukena|setelan|seragam|sarimbit|kaftan|piyama|sepatu|sandal|sneakers|fashion/i.test(
        t.all,
      ),
  },
  {
    site: "KEBUTUHAN RUMAH TANGGA",
    test: (t) =>
      ["Rumah Tangga", "Ibu & Bayi", "Kebutuhan Anak & Bayi", "Peralatan Ibadah", "Al-Quran & Buku"].includes(t.l1) ||
      /sajadah|tasbih|quran|juz|buku|handuk|keset|ember|sapu|botol|alat makan|perlengkapan|kamar mandi|rumah tangga/i.test(
        t.all,
      ),
  },
  // Fallback terakhir (dilaporkan agar mudah ditinjau).
  { site: "KEBUTUHAN RUMAH TANGGA", test: () => true },
];

function mapCategory(l1, l2, leaf, name) {
  const t = { l1, l2, leaf, name, cat: [l1, l2, leaf].join(" "), all: [l1, l2, leaf, name].join(" ") };
  for (const r of RULES) {
    if (r.test(t)) return r.site;
  }
  return "KEBUTUHAN RUMAH TANGGA";
}

/** Deskripsi teks Evermos -> HTML paragraf siap render (escape & < > dulu). */
function descToHtml(text) {
  const raw = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return "";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return raw
    .split(/\n{2,}/)
    .map((p) => "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>")
    .join("\n");
}

function main() {
  const exportProducts = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "products-cache.json"), "utf8")).products || [];
  const exportVariants = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "variant-cache.json"), "utf8")).products || {};
  const exportDesc = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "description-cache.json"), "utf8")).products || {};

  const products = [];
  const variants = {};
  const descriptions = {};
  const excluded = [];
  const perCat = {};
  const fallbackOrigins = new Map();
  const pairMap = new Map();

  let withVariants = 0;
  let totalVariants = 0;
  let withDescription = 0;
  let emptyDescs = 0;
  let totalChars = 0;

  for (const p of exportProducts) {
    const l1 = p.categoryLevel1 || "";
    const l2 = p.categoryLevel2 || "";
    const leaf = p.category || "";

    if (!l1 || EXCLUDED_L1.includes(l1)) {
      excluded.push(p.id + " (" + l1 + " > " + leaf + ")");
      continue;
    }

    const siteCat = mapCategory(l1, l2, leaf, p.name || "");
    if (siteCat === "KEBUTUHAN RUMAH TANGGA" && !["Rumah Tangga", "Ibu & Bayi", "Kebutuhan Anak & Bayi", "Peralatan Ibadah", "Al-Quran & Buku"].includes(l1)) {
      const isFallback =
        !/sajadah|tasbih|quran|juz|buku|handuk|keset|ember|sapu|botol|alat makan|perlengkapan|kamar mandi|rumah tangga/i.test(
          [l1, l2, leaf, p.name || ""].join(" "),
        );
      if (isFallback) {
        const key = l1 + " > " + leaf;
        fallbackOrigins.set(key, (fallbackOrigins.get(key) || 0) + 1);
      }
    }

    const pairKey = l1 + " > " + leaf + "  =>  " + siteCat;
    pairMap.set(pairKey, (pairMap.get(pairKey) || 0) + 1);
    perCat[siteCat] = (perCat[siteCat] || 0) + 1;

    const image = p.image || "";
    products.push({
      id: p.id,
      modelId: p.modelId,
      marketplace: "evermos",
      name: p.name || "",
      url: p.url || "",
      slug: p.slug || "",
      image: image,
      images: image ? [image] : [],
      location: p.location || "",
      rekomendasiJual: p.rekomendasiJual || "",
      hargaModal: p.hargaModal || "",
      hargaModalCut: p.hargaModalCut || "",
      terjual: p.terjual || "0",
      stok: p.stok || "0",
      profit: p.profit || "",
      category: siteCat,
      categoryEvermos: leaf,
      categoryEvermosL1: l1,
      brand: p.brand || "",
      rating: p.rating || 0,
      detailStatus: p.detailStatus || "missing",
      beratGram: p.beratGram || 0,
      berat: p.berat || "",
      alamatSeller: p.alamatSeller || "",
      ekspedisi: "",
      ekspedisiList: [],
      volume: p.volume || "",
    });

    const v = exportVariants[p.id];
    if (v && v.hasVariants && Array.isArray(v.variants) && v.variants.length > 0) {
      withVariants += 1;
      totalVariants += v.variants.length;
      variants[p.id] = {
        hasVariants: true,
        labelVariant: v.labelVariant || "",
        labelSubVariant: v.labelSubVariant || "",
        variants: v.variants.map((x) => ({
          id: String(x.id),
          name: x.name || "",
          color: x.color ?? null,
          size: x.size ?? null,
          stock: typeof x.stock === "number" ? x.stock : 0,
          isActive: Boolean(x.isActive),
        })),
      };
    } else {
      variants[p.id] = { hasVariants: false, labelVariant: "", labelSubVariant: "", variants: [] };
    }

    const html = descToHtml(exportDesc[p.id]);
    if (html) {
      withDescription += 1;
      totalChars += html.length;
    } else {
      emptyDescs += 1;
    }
    descriptions[p.id] = html;
  }

  // Validasi: semua target kategori harus ada di daftar kanonik situs.
  const invalid = Object.keys(perCat).filter((c) => !SITE_CAT_NAMES.has(c));
  if (invalid.length > 0) {
    throw new Error("Kategori target tidak ada di situs: " + invalid.join(", "));
  }

  const generatedAt = new Date().toISOString();

  fs.writeFileSync(
    path.join(SRC_LIB, "evermos-products-cache.json"),
    JSON.stringify({
      generatedAt: generatedAt,
      marketplace: "evermos",
      codePrefix: "EVM",
      source: "evermos-export/products-cache.json",
      categories: siteCats,
      count: products.length,
      products: products,
    }),
  );

  fs.writeFileSync(
    path.join(SRC_LIB, "evermos-variant-cache.json"),
    JSON.stringify({
      generatedAt: generatedAt,
      marketplace: "evermos",
      scanned: products.length,
      withVariants: withVariants,
      totalVariants: totalVariants,
      products: variants,
    }),
  );

  fs.writeFileSync(
    path.join(SRC_LIB, "evermos-description-cache.json"),
    JSON.stringify({
      generatedAt: generatedAt,
      marketplace: "evermos",
      scanned: products.length,
      withDescription: withDescription,
      empty: emptyDescs,
      totalChars: totalChars,
      products: descriptions,
    }),
  );

  // Laporan audit pemetaan
  const lines = [];
  lines.push("Laporan pemetaan kategori Evermos -> 34 kategori situs");
  lines.push("generatedAt: " + generatedAt);
  lines.push("total export: " + exportProducts.length + ", dipakai: " + products.length + ", dikecualikan (non-produk): " + excluded.length);
  lines.push("");
  lines.push("Per kategori situs:");
  Object.entries(perCat)
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => lines.push("  " + String(n).padStart(5) + "  " + c));
  lines.push("");
  lines.push("Fallback (tidak cocok aturan spesifik): " + [...fallbackOrigins.values()].reduce((s, n) => s + n, 0));
  [...fallbackOrigins.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, n]) => lines.push("  " + String(n).padStart(5) + "  " + k));
  lines.push("");
  lines.push("Pasangan asal => target (lengkap):");
  [...pairMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, n]) => lines.push("  " + String(n).padStart(5) + "  " + k));
  if (excluded.length > 0) {
    lines.push("");
    lines.push("Dikecualikan:");
    excluded.forEach((e) => lines.push("  " + e));
  }
  fs.writeFileSync(path.join(EXPORT_DIR, "_site-map-report.txt"), lines.join("\n"));

  console.log("[site] selesai:");
  console.log("  products     : " + products.length + " (dikecualikan " + excluded.length + ")");
  console.log("  withVariants : " + withVariants + " (" + totalVariants + " varian)");
  console.log("  deskripsi    : " + withDescription + " terisi, " + emptyDescs + " kosong");
  console.log("  kategori     : " + Object.keys(perCat).length + " dari " + SITE_CAT_NAMES.size + " situs terpakai");
}

main();
