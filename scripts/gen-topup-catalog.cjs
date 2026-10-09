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
  "FREE FIRE": {
    slug: "free-fire",
    label: "Free Fire",
    prefixes: ["Free Fire"],
    category: "game",
  },
  "FREE FIRE MAX": {
    slug: "free-fire-max",
    label: "Free Fire MAX",
    prefixes: ["Free Fire MAX", "FREE FIRE MAX"],
    category: "game",
  },
  "PUBG MOBILE": {
    slug: "pubg-mobile",
    label: "PUBG Mobile",
    prefixes: ["PUBG MOBILE"],
    category: "game",
  },
  Valorant: { slug: "valorant", label: "Valorant", prefixes: ["Valorant"], category: "game" },
  "Genshin Impact": {
    slug: "genshin-impact",
    label: "Genshin Impact",
    prefixes: ["GENSHIN IMPACT", "Genshin Impact"],
    needsServer: true,
    category: "game",
  },
  "Honkai Star Rail": {
    slug: "honkai-star-rail",
    label: "Honkai: Star Rail",
    prefixes: ["HONKAI: STAR RAIL", "Honkai: Star Rail", "Honkai Star Rail"],
    needsServer: true,
    category: "game",
  },
  "MOBILE LEGENDS": {
    slug: "mobile-legends",
    label: "Mobile Legends",
    prefixes: ["MOBILE LEGENDS", "Mobile Legends"],
    needsServer: true,
    customerNoLabel: "User ID",
    category: "game",
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
  // ---- Voucher game (kategori Digiflazz "Voucher", email/kode/ID game) ----
  "Steam Wallet": {
    slug: "steam-wallet",
    label: "Steam Wallet",
    prefixes: ["Steam Wallet", "STEAM WALLET"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "Email",
  },
  "Steam Wallet (IDR)": {
    slug: "steam-wallet-idr",
    label: "Steam Wallet (IDR)",
    prefixes: ["Steam Wallet (IDR)", "STEAM WALLET (IDR)"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "Email",
  },
  "Razer Gold": {
    slug: "razer-gold",
    label: "Razer Gold",
    prefixes: ["Razer Gold", "RAZER GOLD"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "Email",
  },
  "GOOGLE PLAY INDONESIA": {
    slug: "google-play",
    label: "Google Play (ID)",
    prefixes: ["Google Play Gift Card Indonesia", "GOOGLE PLAY GIFT CARD INDONESIA"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "Email",
  },
  "GOOGLE PLAY US REGION": {
    slug: "google-play-us",
    label: "Google Play (US)",
    prefixes: ["Google Play Gift Card US", "GOOGLE PLAY GIFT CARD US"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "Email",
  },
  MYCARD: {
    slug: "mycard",
    label: "MyCard",
    prefixes: ["MyCard", "MYCARD"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "Email",
  },
  iTunes: {
    slug: "itunes",
    label: "iTunes",
    prefixes: ["iTunes", "ITUNES"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "Email",
  },
  PLAYSTATION: {
    slug: "playstation",
    label: "PlayStation",
    prefixes: ["Playstation", "PLAYSTATION", "Voucher Playstation"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "Email / Nomor HP",
  },
  XBOX: {
    slug: "xbox",
    label: "Xbox",
    prefixes: ["Xbox", "XBOX", "Xbox Card"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "Email / Nomor HP",
  },
  "Nintendo eShop": {
    slug: "nintendo-eshop",
    label: "Nintendo eShop",
    prefixes: ["Nintendo eShop", "Voucher Nintendo eShop"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "Email / Nomor HP",
  },
  "Unipin Voucher": {
    slug: "unipin",
    label: "UniPin",
    prefixes: ["Unipin", "UNIPIN", "Voucher Unipin"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "Email / Nomor HP",
  },
  "Riot Cash": {
    slug: "riot-cash",
    label: "Riot Cash",
    prefixes: ["Riot Cash", "Voucher Riot Cash"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "Email / Nomor HP",
  },
  "POINT BLANK": {
    slug: "point-blank",
    label: "Point Blank",
    prefixes: ["Point Blank", "POINT BLANK", "Voucher Point Blank"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "ID Game / Email",
  },
  eFootball: {
    slug: "efootball",
    label: "eFootball",
    prefixes: ["eFootball", "EFOOTBALL"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "ID Game / Email",
  },
  IDV: {
    slug: "idv",
    label: "IDV",
    prefixes: ["IDV"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "ID Game / Email",
  },
  GARENA: {
    slug: "garena",
    label: "Garena",
    prefixes: ["Garena", "GARENA"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "ID Game / Email",
  },
  Minecraft: {
    slug: "minecraft",
    label: "Minecraft",
    prefixes: ["Minecraft", "MINECRAFT"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "Email",
  },
  "WAVE GAME": {
    slug: "wave-game",
    label: "Wave Game",
    prefixes: ["Wave Game", "WAVE GAME"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "ID Game / Email",
  },
  MEGAXUS: {
    slug: "megaxus",
    label: "MEGAXUS",
    prefixes: ["Megaxus", "MEGAXUS"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "ID Game / Email",
  },
  "Conquer Online": {
    slug: "conquer-online",
    label: "Conquer Online",
    prefixes: ["Conquer Online", "CONQUER ONLINE"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "ID Game / Email",
  },
  "Heroes Evolved": {
    slug: "heroes-evolved",
    label: "Heroes Evolved",
    prefixes: ["Heroes Evolved", "HEROES EVOLVED"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "ID Game / Email",
  },
  "Game-On Credits": {
    slug: "game-on",
    label: "Game-On Credits",
    prefixes: ["Game-On", "Voucher Game-On"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "ID Game / Email",
  },
  "Dota Auto Chess Candy (Global)": {
    slug: "dota-auto-chess",
    label: "Dota Auto Chess",
    prefixes: ["Dota Auto Chess", "Voucher Dota Auto Chess"],
    category: "game",
    targetNumeric: false,
    customerNoLabel: "ID Game / Email",
  },
  // ---- Voucher e-money & belanja (nomor HP terdaftar) ----
  GRAB: { slug: "grab", label: "Grab", prefixes: ["Grab", "GRAB"], category: "emoney", customerNoLabel: "Nomor HP" },
  Tokopedia: { slug: "tokopedia", label: "Tokopedia", prefixes: ["Tokopedia", "TOKOPEDIA"], category: "emoney", customerNoLabel: "Nomor HP" },
  "Touch N Go": { slug: "touch-n-go", label: "Touch N Go", prefixes: ["Touch N Go", "TOUCH N GO"], category: "emoney", customerNoLabel: "Nomor HP" },
  "Traveloka E-Voucher": {
    slug: "traveloka",
    label: "Traveloka",
    prefixes: ["Traveloka", "TRAVELOKA"],
    category: "emoney",
    targetNumeric: false,
    customerNoLabel: "Email / Nomor HP",
  },
  MyPertamina: {
    slug: "mypertamina",
    label: "MyPertamina",
    prefixes: ["MyPertamina", "MYPERTAMINA"],
    category: "emoney",
    customerNoLabel: "Nomor HP",
  },
  "ALFAMART VOUCHER": {
    slug: "alfamart",
    label: "Alfamart",
    prefixes: ["Alfamart", "ALFAMART"],
    category: "emoney",
    customerNoLabel: "Nomor HP",
  },
  INDOMARET: {
    slug: "indomaret",
    label: "Indomaret",
    prefixes: ["Indomaret", "INDOMARET"],
    category: "emoney",
    customerNoLabel: "Nomor HP",
  },
  // ---- Voucher streaming ----
  SPOTIFY: {
    slug: "spotify",
    label: "Spotify",
    prefixes: ["Spotify", "SPOTIFY", "Voucher Spotify"],
    category: "tv",
    targetNumeric: false,
    customerNoLabel: "Email",
  },
  Viu: {
    slug: "viu",
    label: "Viu",
    prefixes: ["Viu", "VIU", "Voucher Viu"],
    category: "tv",
    targetNumeric: false,
    customerNoLabel: "Email / Nomor HP",
  },
  Vidio: {
    slug: "vidio",
    label: "Vidio",
    prefixes: ["Vidio", "VIDIO"],
    category: "tv",
    customerNoLabel: "Nomor HP",
  },
  "Vision+": {
    slug: "visionplus",
    label: "Vision+",
    prefixes: ["Vision+", "VISION+", "Vision +"],
    category: "tv",
    targetNumeric: false,
    customerNoLabel: "Email / Nomor HP",
  },
  WeTV: {
    slug: "wetv",
    label: "WeTV",
    prefixes: ["WeTV", "WETV"],
    category: "tv",
    targetNumeric: false,
    customerNoLabel: "Email / Nomor HP",
  },
  Genflix: {
    slug: "genflix",
    label: "Genflix",
    prefixes: ["Genflix", "GENFLIX"],
    category: "tv",
    targetNumeric: false,
    customerNoLabel: "Email / Nomor HP",
  },
  Folaplay: {
    slug: "folaplay",
    label: "Folaplay",
    prefixes: ["Folaplay", "FOLAPLAY", "Voucher Folaplay"],
    category: "tv",
    targetNumeric: false,
    customerNoLabel: "Email / Nomor HP",
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
    // Meta brand bisa memaksa kategori UI (voucher game → "game", voucher
    // streaming → "tv", voucher e-money → "emoney").
    const meta = metaFor(it.brand);
    const category = meta.category || CATEGORY_MAP[it.category];
    if (!category) {
      console.warn("[gen-topup] kategori Digiflazz tidak dikenali: " + it.category + " (" + it.buyer_sku_code + ")");
      continue;
    }
    if (it.buyer_product_status !== true || it.seller_product_status !== true) {
      console.warn("[gen-topup] SKU nonaktif dilewati: " + it.buyer_sku_code);
      continue;
    }
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
`;
  // Setiap elemen diberi type assertion `as TopUpProduct` supaya TS
  // mengecek tiap objek lewat contextual typing — array literal mentah
  // dengan ribuan elemen membuat TS menghitung union literal raksasa
  // dan memicu TS2590 "union type is too complex" (data lama kebetulan
  // lolos; data baru gagal pada chunk ke-4 saat dipakai format chunk).
  const jp = (arr) =>
    "[" +
    arr.map((p) => `(${JSON.stringify(p)} as TopUpProduct)`).join(", ") +
    "]";
  return (
    header +
    `\nexport const TOPUP_PRODUCTS: TopUpProduct[] = ${jp(products)};\n\n` +
    `export function providerBySlug(slug: string): TopUpProvider | undefined {\n` +
    `  return TOPUP_PROVIDERS.find((p) => p.slug === slug);\n` +
    `}\n\n` +
    `export function providerForSku(sku: string): TopUpProvider | undefined {\n` +
    `  return TOPUP_PROVIDERS.find((p) => p.nominals.some((n) => n.sku === sku));\n` +
    `}\n\n` +
    `/** Provider yang punya nominal pada kategori ini (untuk grid beranda). */\n` +
    `export function categoryProviders(cat: TopUpCategory): TopUpProvider[] {\n` +
    `  return TOPUP_PROVIDERS.filter((p) => p.nominals.some((n) => n.category === cat));\n` +
    `}\n\n` +
    `/** Nominal provider pada kategori tertentu (untuk tab halaman provider). */\n` +
    `export function categoryNominals(p: TopUpProvider, cat: TopUpCategory): TopUpNominal[] {\n` +
    `  return p.nominals.filter((n) => n.category === cat);\n` +
    `}\n\n` +
    `/** Harga jual termurah provider pada kategori tertentu. */\n` +
    `export function categoryMinPrice(p: TopUpProvider, cat: TopUpCategory): number {\n` +
    `  const ns = categoryNominals(p, cat);\n` +
    `  return ns.length ? Math.min(...ns.map((n) => n.sellPrice)) : 0;\n` +
    `}\n\n` +
    `export function formatRupiah(n: number): string {\n` +
    `  return "Rp " + new Intl.NumberFormat("id-ID").format(n);\n` +
    `}\n\n` +
    `/** Nomor tujuan Digiflazz: ML = "user_id zone_id", lainnya = id/nomor apa adanya. */\n` +
    `export function customerNoFor(p: TopUpProduct, id: string, server: string): string {\n` +
    `  const uid = id.trim();\n` +
    `  if (!p.needsServer) return uid;\n` +
    `  const zone = server.trim();\n` +
    `  return zone ? uid + " " + zone : uid;\n` +
    `}\n`
  );
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
