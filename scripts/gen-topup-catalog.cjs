// Generator katalog top-up: tarik price-list Digiflazz (API langsung →
// fallback relay → fallback snapshot _dg-pricelist.json di root) lalu tulis
// ulang src/lib/topup.ts dengan struktur provider + nominal.
// Jalankan:  node scripts/gen-topup-catalog.cjs
// Margin: game 10%, non-game 5%; sellPrice dibulatkan ke atas 100 rupiah.
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const SNAPSHOT = path.join(ROOT, "_dg-pricelist.json");
const OUT = path.join(ROOT, "src", "lib", "topup.ts");

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

function readEnv() {
  const map = {};
  if (!fs.existsSync(ENV_FILE)) return map;
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) map[m[1]] = m[2].trim();
  }
  return map;
}

async function fetchPriceList(env) {
  const username = env.DIGIFLAZZ_USERNAME;
  const apiKey = env.DIGIFLAZZ_API_KEY;
  if (username && apiKey) {
    const payload = {
      cmd: "prepaid",
      username,
      sign: md5(username + apiKey + "pricelist"),
    };
    const targets = [];
    targets.push(["API langsung", "https://api.digiflazz.com/v1/price-list", null]);
    if (env.DIGIFLAZZ_RELAY_URL && env.DIGIFLAZZ_RELAY_TOKEN) {
      targets.push([
        "relay",
        env.DIGIFLAZZ_RELAY_URL + "?ep=price-list",
        env.DIGIFLAZZ_RELAY_TOKEN,
      ]);
    }
    for (const [label, url, token] of targets) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "X-Relay-Token": token } : {}),
          },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          /* bukan JSON */
        }
        if (parsed && Array.isArray(parsed.data) && parsed.data.length) {
          console.log("[gen-topup] sumber: " + label + " (" + parsed.data.length + " SKU)");
          return { items: parsed.data, live: true };
        }
        console.warn("[gen-topup] " + label + " gagal: " + text.slice(0, 160).replace(/\s+/g, " "));
      } catch (e) {
        console.warn("[gen-topup] " + label + " error: " + String(e));
      }
    }
  }
  if (fs.existsSync(SNAPSHOT)) {
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
    if (Array.isArray(snap.data) && snap.data.length) {
      console.log("[gen-topup] sumber: snapshot lokal (" + snap.data.length + " SKU)");
      return { items: snap.data, live: false };
    }
  }
  throw new Error("Tidak ada sumber price-list (API/relay/snapshot) yang berhasil.");
}

// Kategori UI + pemetaan kategori Digiflazz → kategori UI.
const CATEGORIES = [
  { id: "game", label: "Top Up Game", desc: "Diamond & item game favorit", targetLabel: "ID Game" },
  { id: "pulsa", label: "Pulsa & Paket", desc: "Pulsa semua operator", targetLabel: "Nomor HP" },
  { id: "data", label: "Paket Data", desc: "Paket data & voucher internet", targetLabel: "Nomor HP" },
  { id: "pln", label: "Token Listrik", desc: "Token listrik prabayar", targetLabel: "Nomor Meter / ID Pelanggan" },
  { id: "emoney", label: "E-Wallet", desc: "Isi saldo e-wallet", targetLabel: "Nomor HP" },
  { id: "tv", label: "TV & Gas", desc: "K-Vision & Pertamina Gas", targetLabel: "Nomor Pelanggan" },
];

const CATEGORY_MAP = {
  Games: "game",
  Pulsa: "pulsa",
  "Masa Aktif": "pulsa",
  "Paket SMS & Telpon": "pulsa",
  Data: "data",
  Voucher: "data",
  "Aktivasi Voucher": "data",
  "Aktivasi Perdana": "data",
  PLN: "pln",
  "E-Money": "emoney",
  TV: "tv",
  Gas: "tv",
  Streaming: "tv",
};

// Meta brand → provider. prefixes: awalan nama produk yang dibuang agar nama
// nominal pendek ("Telkomsel 10.000" → "10.000").
const BRANDS = {
  "FREE FIRE": { slug: "free-fire", label: "Free Fire", prefixes: ["Free Fire"] },
  "FREE FIRE MAX": {
    slug: "free-fire-max",
    label: "Free Fire MAX",
    prefixes: ["Free Fire MAX", "FREE FIRE MAX"],
  },
  "PUBG MOBILE": { slug: "pubg-mobile", label: "PUBG Mobile", prefixes: ["PUBG MOBILE"] },
  Valorant: { slug: "valorant", label: "Valorant", prefixes: ["Valorant"] },
  "GENSHIN IMPACT": {
    slug: "genshin-impact",
    label: "Genshin Impact",
    prefixes: ["GENSHIN IMPACT", "Genshin Impact"],
  },
  "HONKAI: STAR RAIL": {
    slug: "honkai-star-rail",
    label: "Honkai: Star Rail",
    prefixes: ["HONKAI: STAR RAIL", "Honkai: Star Rail", "Honkai Star Rail"],
  },
  "MOBILE LEGENDS": {
    slug: "mobile-legends",
    label: "Mobile Legends",
    prefixes: ["MOBILE LEGENDS", "Mobile Legends"],
    needsServer: true,
    customerNoLabel: "User ID",
  },
  TELKOMSEL: { slug: "telkomsel", label: "Telkomsel", prefixes: ["Telkomsel"] },
  INDOSAT: { slug: "indosat", label: "Indosat", prefixes: ["Indosat"] },
  AXIS: { slug: "axis", label: "Axis", prefixes: ["Axis"] },
  XL: { slug: "xl", label: "XL", prefixes: ["XL", "Xl"] },
  TRI: { slug: "tri", label: "Tri", prefixes: ["Tri", "Three"] },
  SMARTFREN: { slug: "smartfren", label: "Smartfren", prefixes: ["Smartfren"] },
  "by.U": { slug: "byu", label: "by.U", prefixes: ["by.U"] },
  DANA: { slug: "dana", label: "DANA", prefixes: ["DANA", "Dana"] },
  OVO: { slug: "ovo", label: "OVO", prefixes: ["OVO"] },
  "GO PAY": { slug: "gopay", label: "GoPay", prefixes: ["Go Pay", "GO PAY"] },
  "SHOPEE PAY": { slug: "shopeepay", label: "ShopeePay", prefixes: ["SHOPEE PAY", "Shopee Pay"] },
  PLN: { slug: "pln", label: "PLN", prefixes: ["PLN"] },
  "K-VISION dan GOL": {
    slug: "k-vision",
    label: "K-Vision & GOL",
    prefixes: [],
    targetNumeric: false,
  },
  "Pertamina Gas": {
    slug: "pertamina-gas",
    label: "Pertamina Gas",
    prefixes: ["Pertagas"],
  },
};

const FALLBACK_META = { slug: null, label: null, prefixes: [] };

function metaFor(brand) {
  return BRANDS[brand] || FALLBACK_META;
}

function shortName(productName, brand) {
  const meta = metaFor(brand);
  const lower = productName.toLowerCase();
  for (const p of meta.prefixes) {
    if (lower.startsWith(p.toLowerCase())) {
      return productName.slice(p.length).replace(/^[\s:.-]+/, "");
    }
  }
  return productName;
}

/** Tag kecil pada kartu nominal: desc pendek (mis. "Reguler") atau type;
 *  duplikat nama produk dibuang agar kartu tidak tampil ganda. */
function nominalTag(item) {
  const desc = String(item.desc ?? "").trim();
  const type = String(item.type ?? "").trim();
  if (desc && desc !== "-" && desc.length <= 30) return desc;
  if (type && type !== "Umum" && type.length <= 30) {
    if (type.toLowerCase() === String(item.product_name ?? "").toLowerCase()) return "";
    return type;
  }
  return "";
}

function build(items) {
  const providers = new Map();
  const products = [];
  for (const it of items) {
    const category = CATEGORY_MAP[it.category];
    if (!category) {
      console.warn("[gen-topup] kategori Digiflazz tidak dikenali: " + it.category + " (" + it.buyer_sku_code + ")");
      continue;
    }
    if (it.buyer_product_status !== true || it.seller_product_status !== true) {
      console.warn("[gen-topup] SKU nonaktif dilewati: " + it.buyer_sku_code);
      continue;
    }
    const meta = metaFor(it.brand);
    const slug = meta.slug || String(it.brand).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const label = meta.label || it.brand;
    const cat = CATEGORIES.find((c) => c.id === category);
    const cost = Number(it.price);
    const margin = category === "game" ? 0.1 : 0.05;
    const sell = Math.ceil((cost * (1 + margin)) / 100) * 100;

    // Provider = brand, lintas kategori (Telkomsel punya pulsa + data +
    // telepon). Kategori dibawa oleh NOMINAL; provider memakai kategori
    // dengan nominal terbanyak sebagai primaryCategory untuk pengurutan.
    let prov = providers.get(slug);
    if (!prov) {
      prov = {
        slug,
        brand: it.brand,
        label,
        customerNoLabel: meta.customerNoLabel || cat.targetLabel,
        targetNumeric: meta.targetNumeric !== false,
        ...(meta.needsServer ? { needsServer: true } : {}),
        nominals: [],
      };
      providers.set(slug, prov);
    }
    prov.nominals.push({
      sku: it.buyer_sku_code,
      name: shortName(it.product_name, it.brand),
      type: nominalTag(it),
      costPrice: cost,
      sellPrice: sell,
      category,
    });

    products.push({
      sku: it.buyer_sku_code,
      brand: it.brand,
      name: it.product_name,
      costPrice: cost,
      sellPrice: sell,
      category,
      ...(meta.needsServer ? { needsServer: true } : {}),
      customerNoLabel: meta.customerNoLabel || cat.targetLabel,
    });
  }

  const catOrder = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  const providerList = [...providers.values()].map((p) => {
    const nominals = p.nominals.sort((a, b) => a.costPrice - b.costPrice);
    // Kategori mayoritas = kategori dengan nominal terbanyak.
    const counts = new Map();
    for (const n of nominals) counts.set(n.category, (counts.get(n.category) || 0) + 1);
    let primaryCategory = nominals[0]?.category || CATEGORIES[0].id;
    let best = -1;
    for (const [cat, count] of counts) {
      const rank = catOrder.get(cat) ?? 0;
      if (count > best || (count === best && rank < catOrder.get(primaryCategory))) {
        best = count;
        primaryCategory = cat;
      }
    }
    return { ...p, primaryCategory, nominals };
  });
  providerList.sort(
    (a, b) =>
      catOrder.get(a.primaryCategory) - catOrder.get(b.primaryCategory) ||
      a.label.localeCompare(b.label),
  );
  products.sort((a, b) => a.name.localeCompare(b.name));
  return { categories: CATEGORIES, providers: providerList, products };
}

function genTs({ categories, providers, products }) {
  const j = (v) => JSON.stringify(v, null, 2).replace(/\n\s*/g, " ").replace(/\} \"/g, '} "');
  const header = `// Katalog produk Top Up & Isi Saldo KTD Store.
// FILE DIGENERASI OTOMATIS — jangan edit manual. Sumber: price-list Digiflazz
// (/v1/price-list, cmd "prepaid"). Regenerasi: node scripts/gen-topup-catalog.cjs
// Margin: game 10%, non-game 5%; sellPrice dibulatkan ke atas 100 rupiah.

export type TopUpCategory = "game" | "pulsa" | "data" | "pln" | "emoney" | "tv";

export interface TopUpCategoryInfo {
  id: TopUpCategory;
  label: string;
  desc: string;
  /** Label kolom input nomor tujuan bawaan kategori. */
  targetLabel: string;
}

export interface TopUpNominal {
  /** buyer_sku_code Digiflazz. */
  sku: string;
  /** Nama tampilan pendek (awalan brand dibuang). */
  name: string;
  /** Tag kecil di kartu (mis. "Reguler", "Flash"). */
  type: string;
  /** Harga beli dari Digiflazz (Rp). */
  costPrice: number;
  /** Harga jual ke pembeli (Rp), sudah termasuk margin. */
  sellPrice: number;
  /** Kategori UI nominal — provider bisa lintas kategori (Telkomsel). */
  category: TopUpCategory;
}

export interface TopUpProvider {
  /** Slug URL, mis. "free-fire". */
  slug: string;
  /** Nama brand dari Digiflazz, mis. "FREE FIRE". */
  brand: string;
  /** Nama tampilan, mis. "Free Fire". */
  label: string;
  /** Kategori mayoritas provider (dipakai untuk pengurutan halaman). */
  primaryCategory: TopUpCategory;
  /** Label kolom input nomor tujuan. */
  customerNoLabel: string;
  /** false = input bebas teks (K-Vision). */
  targetNumeric: boolean;
  /** Produk Mobile Legends: butuh kolom Server/Zone. */
  needsServer?: boolean;
  nominals: TopUpNominal[];
}

export interface TopUpProduct {
  /** buyer_sku_code Digiflazz. */
  sku: string;
  brand: string;
  name: string;
  /** Harga beli dari Digiflazz (Rp). */
  costPrice: number;
  /** Harga jual ke pembeli (Rp), sudah termasuk margin. */
  sellPrice: number;
  category: TopUpCategory;
  /** Produk Mobile Legends: butuh kolom Server/Zone. */
  needsServer?: boolean;
  /** Label kolom input nomor tujuan (ID game / nomor HP / nomor meter). */
  customerNoLabel: string;
}

export const TOPUP_CATEGORIES: TopUpCategoryInfo[] = ${j(categories)};

export const TOPUP_PROVIDERS: TopUpProvider[] = ${j(providers)};

export const TOPUP_PRODUCTS: TopUpProduct[] = ${j(products)};

export function providerBySlug(slug: string): TopUpProvider | undefined {
  return TOPUP_PROVIDERS.find((p) => p.slug === slug);
}

export function providerForSku(sku: string): TopUpProvider | undefined {
  return TOPUP_PROVIDERS.find((p) => p.nominals.some((n) => n.sku === sku));
}

/** Provider yang punya nominal pada kategori ini (untuk grid beranda). */
export function categoryProviders(cat: TopUpCategory): TopUpProvider[] {
  return TOPUP_PROVIDERS.filter((p) => p.nominals.some((n) => n.category === cat));
}

/** Nominal provider pada kategori tertentu (untuk tab halaman provider). */
export function categoryNominals(p: TopUpProvider, cat: TopUpCategory): TopUpNominal[] {
  return p.nominals.filter((n) => n.category === cat);
}

/** Harga jual termurah provider pada kategori tertentu. */
export function categoryMinPrice(p: TopUpProvider, cat: TopUpCategory): number {
  const ns = categoryNominals(p, cat);
  return ns.length ? Math.min(...ns.map((n) => n.sellPrice)) : 0;
}

export function formatRupiah(n: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID").format(n);
}

/** Nomor tujuan Digiflazz: ML = "user_id zone_id", lainnya = id/nomor apa adanya. */
export function customerNoFor(p: TopUpProduct, id: string, server: string): string {
  const uid = id.trim();
  if (!p.needsServer) return uid;
  const zone = server.trim();
  return zone ? uid + " " + zone : uid;
}
`;
  return header;
}

async function main() {
  const env = readEnv();
  const { items, live } = await fetchPriceList(env);
  const built = build(items);
  fs.writeFileSync(OUT, genTs(built), "utf8");
  // Segarkan snapshot fallback HANYA bila sumber live — fallback snapshot
  // tidak boleh menimpa snapshot yang lebih lengkap (bug lama: snapshot
  // terdegradasi saat API kena rate-limit rc=83).
  if (live) {
    fs.writeFileSync(SNAPSHOT, JSON.stringify({ data: items }, null, 2), "utf8");
    console.log("[gen-topup] snapshot disegarkan: " + SNAPSHOT);
  } else {
    console.log("[gen-topup] sumber snapshot — snapshot TIDAK ditulis ulang.");
  }
  const perCat = built.categories
    .map((c) => {
      const prods = built.products.filter((p) => p.category === c.id).length;
      const provs = built.providers.filter((p) => p.nominals.some((n) => n.category === c.id)).length;
      return c.label + ": " + provs + " provider / " + prods + " SKU";
    })
    .join(" | ");
  console.log("[gen-topup] ditulis: " + OUT);
  console.log("[gen-topup] " + built.products.length + " SKU, " + built.providers.length + " provider");
  console.log("[gen-topup] " + perCat);
}

main().catch((e) => {
  console.error("[gen-topup] gagal: " + String(e));
  process.exit(1);
});
