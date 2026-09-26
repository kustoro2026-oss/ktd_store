/**
 * scrape-evermos-products.cjs
 * Scraper produk Evermos (https://evermos.com) via API internal api.evermos.com.
 *
 * Konvensi: semua hasil Evermos masuk folder evermos-scrape/ dan tiap produk diberi kode EVM-<modelId>.
 *
 * Cara pakai:
 *   1. Login di https://evermos.com/browse (browser), buka DevTools Console:
 *        console.log(JSON.parse(localStorage.getItem("flutter.token")))
 *   2. Jalankan (pilih salah satu):
 *        node scripts/scrape-evermos-products.cjs --token="Bearer eyJ..."
 *        # atau simpan token (tanpa tanda kutip) ke evermos-scrape/.evermos-token lalu:
 *        node scripts/scrape-evermos-products.cjs
 *
 * Opsi:
 *   --token=...            Bearer token (menimpa file/env)
 *   --details=all|none|N   ambil detail (default: all). N = hanya N item pertama
 *   --fresh                abaikan checkpoint, mulai dari awal
 *   --concurrency=4        paralelisme fetch detail
 *   --delay-ms=150         jeda antar request detail per worker
 *
 * Output (di evermos-scrape/):
 *   evermos-products.json     data lengkap (kode EVM-<modelId>, marketplace "evermos")
 *   evermos-categories.json   daftar kategori
 *   .evermos-token            (opsional) token sesi
 *   .tmp-list.json / .tmp-details.json  checkpoint resume
 */

"use strict";

const fs = require("fs");
const path = require("path");

const API = "https://api.evermos.com";
const OUT_DIR = path.join(__dirname, "..", "evermos-scrape");
const TOKEN_FILE = path.join(OUT_DIR, ".evermos-token");
const LIST_CKPT = path.join(OUT_DIR, ".tmp-list.json");
const DETAIL_CKPT = path.join(OUT_DIR, ".tmp-details.json");
const OUT_PRODUCTS = path.join(OUT_DIR, "evermos-products.json");
const OUT_CATEGORIES = path.join(OUT_DIR, "evermos-categories.json");

const PAGE_SIZE = 100;
const MAX_RETRY = 4;
const DETAIL_SAVE_EVERY = 100;

// ---------- argumen CLI ----------
function getArg(name, def) {
  const hit = process.argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : def;
}
const hasFlag = (name) => process.argv.includes("--" + name);

const opts = {
  token: getArg("token", ""),
  details: getArg("details", "all"),
  fresh: hasFlag("fresh"),
  concurrency: Math.max(1, parseInt(getArg("concurrency", "4"), 10) || 4),
  delayMs: Math.max(0, parseInt(getArg("delay-ms", "150"), 10) || 0)
};

// ---------- util ----------
function loadToken() {
  if (opts.token) return opts.token;
  if (process.env.EVERMOS_BEARER_TOKEN) return process.env.EVERMOS_BEARER_TOKEN;
  if (fs.existsSync(TOKEN_FILE)) {
    return fs.readFileSync(TOKEN_FILE, "utf8").trim().replace(/^"|"$/g, "").replace(/^Bearer\s+/i, "");
  }
  return "";
}
let TOKEN = loadToken();
if (!TOKEN) {
  console.error("Token tidak ditemukan. Isi dengan --token=... / env EVERMOS_BEARER_TOKEN / file evermos-scrape/.evermos-token");
  process.exit(1);
}

const headers = () => ({
  Authorization: TOKEN.startsWith("Bearer ") ? TOKEN : "Bearer " + TOKEN,
  "content-type": "application/json",
  "Platform-Information": "Web-chrome-457"
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiFetch(url) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await fetch(url, { headers: headers() });
      if (res.status === 401 || res.status === 403) {
        const e = new Error("TOKEN_EXPIRED");
        e.code = "TOKEN_EXPIRED";
        throw e;
      }
      if (res.status === 429 || res.status >= 500) throw new Error("HTTP " + res.status);
      if (!res.ok) {
        const e = new Error("HTTP " + res.status);
        e.status = res.status;
        throw e;
      }
      return await res.json();
    } catch (err) {
      if (err.code === "TOKEN_EXPIRED") throw err;
      if (err.status && err.status < 500 && err.status !== 429) throw err;
      lastErr = err;
      await sleep(600 * attempt);
    }
  }
  throw lastErr;
}

function searchBody(size, nextCursor) {
  return JSON.stringify({
    brandId: null, categoryId: null, coverImageSize: 1, districtIds: [],
    hasWholesalePrice: null, isCod: null, isMarketplaceable: null, isPo: null,
    coin: { min: null, max: null, hasBonus: null }, isWarehouse: null,
    maxPrice: null, minPrice: null, nextCursor: nextCursor || null, orderBy: null,
    size: size, stockLocationIds: [], tagIds: [], text: "", useThirdPartyRecommendation: false,
    productId: null, pageType: null, brandLevelIds: [], bannerInterval: null,
    bannerCategory: null, fetchedProducts: null, hasDirectDiscount: null
  });
}

async function searchPage(size, cursor) {
  const res = await fetch(API + "/v1/product-discovery/search", {
    method: "POST", headers: headers(), body: searchBody(size, cursor)
  });
  if (res.status === 401 || res.status === 403) {
    const e = new Error("TOKEN_EXPIRED");
    e.code = "TOKEN_EXPIRED";
    throw e;
  }
  if (!res.ok) throw new Error("HTTP " + res.status + " (search)");
  return await res.json();
}

// ---------- tahap daftar produk ----------
function loadJson(file, def) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return def; }
}
function saveJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj), "utf8");
}

async function fetchList() {
  let products = [];
  let cursor = null;
  let total = 0;
  if (!opts.fresh) {
    const ck = loadJson(LIST_CKPT, null);
    if (ck && Array.isArray(ck.products)) {
      products = ck.products; cursor = ck.cursor || null; total = ck.total || 0;
      console.log("[list] resume dari checkpoint: " + products.length + " produk");
    }
  }
  const seen = new Set(products.map((p) => String(p.modelId)));
  for (;;) {
    const j = await searchPage(PAGE_SIZE, cursor);
    const data = j.data || {};
    const batch = data.products || [];
    total = (data.pagination && data.pagination.total) || total;
    for (const p of batch) {
      const k = String(p.modelId);
      if (!seen.has(k)) { seen.add(k); products.push(p); }
    }
    cursor = (data.pagination && data.pagination.nextCursor) || null;
    console.log("[list] " + products.length + "/" + total + (cursor ? "" : " (habis)"));
    saveJson(LIST_CKPT, { products: products, cursor: cursor, total: total });
    if (!cursor || batch.length === 0 || (total && products.length >= total)) break;
    await sleep(250);
  }
  return { products: products, total: total };
}

// ---------- tahap detail ----------
async function fetchDetail(modelId, slug) {
  const url = API + "/v3/product?modelId=" + encodeURIComponent(modelId) + "&modelSlug=" + encodeURIComponent(slug);
  try {
    const j = await apiFetch(url);
    return (j && j.data) || { _error: "no-data" };
  } catch (err) {
    if (err.code === "TOKEN_EXPIRED") throw err;
    return { _error: "failed", _status: err.status || 0 };
  }
}

async function fetchDetails(products) {
  const details = opts.fresh ? {} : loadJson(DETAIL_CKPT, {});
  const queue = products.filter((p) => !(String(p.modelId) in details));
  if (opts.details !== "all") {
    const n = parseInt(opts.details, 10);
    if (opts.details === "none" || !n) return { details: details, tokenExpired: false };
    queue.splice(n);
  }
  console.log("[detail] antrean: " + queue.length + " (sudah ada: " + Object.keys(details).length + ")");
  let done = 0;
  let tokenExpired = false;
  const workers = [];
  for (let w = 0; w < opts.concurrency; w++) {
    workers.push((async () => {
      while (queue.length && !tokenExpired) {
        const p = queue.shift();
        try {
          details[String(p.modelId)] = await fetchDetail(p.modelId, p.slug);
        } catch (err) {
          if (err.code === "TOKEN_EXPIRED") { tokenExpired = true; break; }
          details[String(p.modelId)] = { _error: "failed", _status: 0 };
        }
        done++;
        if (done % 25 === 0) console.log("[detail] " + done + "/" + (done + queue.length));
        if (done % DETAIL_SAVE_EVERY === 0) saveJson(DETAIL_CKPT, details);
        if (opts.delayMs) await sleep(opts.delayMs);
      }
    })());
  }
  await Promise.all(workers);
  saveJson(DETAIL_CKPT, details);
  return { details: details, tokenExpired: tokenExpired };
}

// ---------- pemetaan output ----------
function mapDetail(d) {
  return {
    description: d.description || "",
    videoUrl: d.videoUrl || "",
    images: d.images || [],
    rating: d.rating != null ? d.rating : null,
    sold: d.totalSold != null ? d.totalSold : (d.sold != null ? d.sold : null),
    weight: d.weight != null ? d.weight : null,
    weightLabel: d.weightLabel || "",
    stock: d.stock != null ? d.stock : null,
    totalStock: d.totalStock != null ? d.totalStock : null,
    labelVariant: d.labelVariant || "",
    labelSubVariant: d.labelSubVariant || "",
    point: d.point != null ? d.point : null,
    minPoint: d.minPoint != null ? d.minPoint : null,
    isCOD: d.isCOD != null ? d.isCOD : null,
    isPO: d.isPO != null ? d.isPO : null,
    poDurationLabel: d.poDurationLabel || "",
    resellerPriceMin: d.resellerPriceMin != null ? d.resellerPriceMin : null,
    resellerPriceMax: d.resellerPriceMax != null ? d.resellerPriceMax : null,
    retailPrice: d.retailPrice != null ? d.retailPrice : null,
    customerPrice: d.customerPrice != null ? d.customerPrice : null,
    discountPrice: d.discountPrice != null ? d.discountPrice : null,
    commissionPrice: d.commissionPrice != null ? d.commissionPrice : null,
    warehouseTitle: d.warehouseTitle || "",
    warehouseAddress: d.warehouseAddress || "",
    categoryId: d.categoryId != null ? d.categoryId : null,
    categoryName: d.categoryName || "",
    categoryLevel1Name: d.categoryLevel1Name || "",
    categoryLevel2Name: d.categoryLevel2Name || "",
    categoryCluster: (d.categoryCluster && d.categoryCluster.name) || "",
    brandId: d.brandId != null ? d.brandId : null,
    brandName: d.brandName || "",
    brandLogo: d.brandLogo || "",
    brandType: d.brandType || "",
    deliveryProgramId: d.deliveryProgramId || "",
    shareableLinkWithoutPrice: d.shareableLinkWithoutPrice || "",
    specialInformations: d.specialInformations || [],
    vouchersCount: Array.isArray(d.vouchers) ? d.vouchers.length : 0,
    variants: (d.variants || []).map((v) => ({
      id: v.id,
      variantId: v.variantId != null ? v.variantId : null,
      name: v.name || "",
      code: v.code || "",
      slug: v.slug || "",
      value: v.value || "",
      defaultSubVariantValue: v.defaultSubVariantValue || "",
      resellerPrice: v.resellerPrice != null ? v.resellerPrice : null,
      retailPrice: v.retailPrice != null ? v.retailPrice : null,
      customerPrice: v.customerPrice != null ? v.customerPrice : null,
      commissionPrice: v.commissionPrice != null ? v.commissionPrice : null,
      weight: v.weight != null ? v.weight : null,
      weightLabel: v.weightLabel || "",
      width: v.width != null ? v.width : null,
      height: v.height != null ? v.height : null,
      length: v.length != null ? v.length : null,
      stock: v.stock != null ? v.stock : null,
      totalStock: v.totalStock != null ? v.totalStock : null,
      rating: v.rating != null ? v.rating : null,
      sold: v.totalSold != null ? v.totalSold : (v.sold != null ? v.sold : null),
      warehouseTitle: v.warehouseTitle || "",
      warehouseFullAddress: v.warehouseFullAddress || "",
      images: v.images || [],
      isPO: v.isPO != null ? v.isPO : null,
      poDurationLabel: v.poDurationLabel || "",
      subVariants: (v.subVariants || []).map((s) => ({
        id: s.id,
        name: s.name || "",
        value: s.value || "",
        stock: s.stock != null ? s.stock : null,
        resellerPrice: s.resellerPrice != null ? s.resellerPrice : null,
        retailPrice: s.retailPrice != null ? s.retailPrice : null,
        commissionPrice: s.commissionPrice != null ? s.commissionPrice : null,
        weight: s.weight != null ? s.weight : null,
        weightLabel: s.weightLabel || "",
        width: s.width != null ? s.width : null,
        height: s.height != null ? s.height : null,
        length: s.length != null ? s.length : null,
        code: s.code || "",
        slug: s.slug || ""
      }))
    }))
  };
}

function buildProduct(p, details) {
  const mid = String(p.modelId);
  const rec = details[mid];
  const isOk = !!(rec && !rec._error);
  const detailStatus = !rec ? "missing" : (isOk ? "ok" : "error");
  return {
    code: "EVM-" + mid,
    marketplace: "evermos",
    evermosUrl: "https://evermos.com/view?modelSlug=" + p.slug + "&modelId=" + mid,
    id: p.id,
    modelId: p.modelId,
    name: p.name,
    slug: p.slug,
    brand: (p.brand && p.brand.brandName) || "",
    brandId: (p.brand && p.brand.brandId) || null,
    category: (p.category && p.category.name) || "",
    categoryLevel2: (p.categoryLevel2 && p.categoryLevel2.name) || "",
    categoryLevel1: (p.categoryLevel1 && p.categoryLevel1.name) || "",
    resellerPrice: p.resellerPrice != null ? p.resellerPrice : null,
    resellerPriceLabel: p.resellerPriceLabel || "",
    normalResellerPrice: p.normalResellerPrice != null ? p.normalResellerPrice : null,
    retailPrice: p.retailPrice != null ? p.retailPrice : null,
    customerPrice: p.customerPrice != null ? p.customerPrice : null,
    commission: p.commission != null ? p.commission : null,
    commissionType: p.commissionType || "",
    commissionLabel: p.commissionLabel || "",
    commissionAmountLabel: p.commissionAmountLabel || "",
    point: (p.coinInfo && p.coinInfo.amount) != null ? p.coinInfo.amount : null,
    pointLabel: (p.coinInfo && p.coinInfo.label) || "",
    stock: p.stock != null ? p.stock : null,
    warehouseLabel: p.warehouseLabel || "",
    stockLocations: p.stockLocations || [],
    hasPo: p.hasPo != null ? p.hasPo : null,
    hasCod: p.hasCod != null ? p.hasCod : null,
    hasDiscount: p.hasDiscount != null ? p.hasDiscount : null,
    hasPriceRange: p.hasPriceRange != null ? p.hasPriceRange : null,
    hasWholesalePrice: p.hasWholesalePrice != null ? p.hasWholesalePrice : null,
    coverImage: p.coverImage || "",
    tags: (p.tags || []).map((t) => t.name),
    shareableLinkWithoutPrice: p.shareableLinkWithoutPrice || "",
    deliveryProgramId: p.deliveryProgramId || "",
    detailStatus: detailStatus,
    detail: isOk ? mapDetail(rec) : null
  };
}

// ---------- main ----------
(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("=== scrape Evermos -> " + OUT_DIR + " ===");

  try {
    const cats = await apiFetch(API + "/category/list");
    saveJson(OUT_CATEGORIES, cats);
    console.log("[kategori] tersimpan: " + ((cats.data || []).length) + " kategori");
  } catch (e) {
    console.warn("[kategori] gagal: " + e.message);
  }

  const listed = await fetchList();
  console.log("[list] selesai: " + listed.products.length + " produk (total dilaporkan: " + listed.total + ")");

  const res = await fetchDetails(listed.products);
  if (res.tokenExpired) {
    console.error("[token] TOKEN EXPIRED. Perbarui token lalu jalankan lagi (resume otomatis dari checkpoint).");
    process.exit(2);
  }

  const arr = listed.products.map((p) => buildProduct(p, res.details));
  const ok = arr.filter((x) => x.detailStatus === "ok").length;
  const err = arr.filter((x) => x.detailStatus === "error").length;
  const miss = arr.filter((x) => x.detailStatus === "missing").length;
  const out = {
    source: "evermos",
    sourceUrl: "https://evermos.com/browse",
    apiBase: API,
    codePrefix: "EVM",
    generatedAt: new Date().toISOString(),
    listTotalReported: listed.total,
    productsCount: arr.length,
    detailsOk: ok,
    detailsError: err,
    detailsMissing: miss,
    products: arr
  };
  fs.writeFileSync(OUT_PRODUCTS, JSON.stringify(out), "utf8");
  console.log("[out] " + OUT_PRODUCTS);
  console.log("[out] " + arr.length + " produk | detail ok=" + ok + " error=" + err + " missing=" + miss);
  if (err === 0 && miss === 0 && listed.products.length >= (listed.total || listed.products.length)) {
    try { fs.unlinkSync(LIST_CKPT); fs.unlinkSync(DETAIL_CKPT); } catch (e) {}
    console.log("[out] checkpoint dihapus (scrape lengkap).");
  }
})().catch((e) => {
  console.error("FATAL: " + (e && e.message ? e.message : e));
  process.exit(1);
});
