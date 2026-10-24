// Katalog top-up EFEKTIF = katalog statis (src/lib/topup.ts) + override DB
// (topup_catalog_live), plus SINKRON OTOMATIS terhadap price-list Digiflazz.
//
// Kenapa butuh lapisan ini: katalog statis adalah file build yang hanya bisa
// diubah lewat regen lokal + commit + deploy. Price-list live bisa berubah
// kapan saja (SKU mati, harga naik, nominal baru) — sinkron menulis DIFF-nya
// ke tabel override, dan semua titik baca memakai resolver di bawah:
//   - SKU mati → disembunyikan dari etalase + ditolak saat order,
//   - modal berubah → harga jual dihitung ulang dengan margin standar,
//   - nominal baru (brand yang dijual) → langsung tampil dijual.
// Baris note='manual' (saklar admin) dilindungi dari sinkron otomatis.
//
// Pemakaian: cron cek-saldo memanggil syncTopupCatalog (mode otomatis),
// tombol admin /api/topup/digiflazz action katalog-sync memanggilnya manual.

import {
  listTopupCatalogOverrides,
  replaceTopupCatalogOverrides,
  type TopupCatalogOverrideRow,
} from "./db";
import { buildPriceListPayload, relayDigiflazz } from "./digiflazz";
import {
  TOPUP_PRODUCTS,
  TOPUP_PROVIDERS,
  type TopUpCategory,
  type TopUpNominal,
  type TopUpProduct,
  type TopUpProvider,
} from "./topup";
import {
  PASCA_PRODUCTS,
  type PascaProduct,
} from "./topup-pasca";
import { notifyTopupOwner } from "./wa";

// ---------- Pemetaan Digiflazz → UI (cermin scripts/gen-topup-catalog.cjs) ----------

/** Kategori Digiflazz → kategori UI. Jaga sinkron dengan CATEGORY_MAP di
 *  gen-topup-catalog.cjs. */
const CATEGORY_MAP: Record<string, TopUpCategory> = {
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

/** Label kolom nomor tujuan per kategori UI (cermin CATEGORIES di
 *  gen-topup-catalog.cjs) — dipakai untuk SKU baru tanpa provider meta. */
const TARGET_LABELS: Record<TopUpCategory, string> = {
  game: "ID Game",
  pulsa: "Nomor HP",
  data: "Nomor HP",
  pln: "Nomor Meter / ID Pelanggan",
  emoney: "Nomor HP",
  tv: "Nomor Pelanggan",
};

/** Harga jual dari modal — margin game 10%, non-game 5%, bulat ke atas
 *  100 rupiah (rumus identik generator katalog). */
function sellFor(cost: number, category: TopUpCategory): number {
  const margin = category === "game" ? 0.1 : 0.05;
  return Math.ceil((cost * (1 + margin)) / 100) * 100;
}

/** Nilai kebenaran price-list bisa boolean `true` atau string "True". */
function isTrue(v: unknown): boolean {
  return String(v ?? "").toLowerCase() === "true";
}

/** Nama tampilan pendek: buang awalan label brand ("Telkomsel 10.000" →
 *  "10.000") — pendekatan mirip shortName() generator (prefixes meta tidak
 *  tersedia di runtime, label provider cukup untuk mayoritas kasus). */
function shortNameFor(productName: unknown, provider: TopUpProvider): string {
  const name = String(productName ?? "").trim();
  const label = provider.label;
  if (label && name.toLowerCase().startsWith(label.toLowerCase())) {
    return name.slice(label.length).replace(/^[\s:.-]+/, "");
  }
  return name;
}

/** Tag kecil kartu nominal — cermin nominalTag() generator. */
function nominalTagFor(item: Record<string, unknown>): string {
  const desc = String(item.desc ?? "").trim();
  const type = String(item.type ?? "").trim();
  if (desc && desc !== "-" && desc.length <= 30) return desc;
  if (type && type !== "Umum" && type.length <= 30) {
    if (type.toLowerCase() === String(item.product_name ?? "").toLowerCase()) return "";
    return type;
  }
  return "";
}

// ---------- Resolver katalog efektif (cache 60 detik) ----------

const CACHE_TTL_MS = 60_000;

type LiveCatalog = {
  at: number;
  products: TopUpProduct[];
  providers: TopUpProvider[];
  pasca: EffectivePascaProduct[];
};

/** Produk pasca efektif: katalog statis + override (active/admin dari kolom
 *  cost). Baris override SKU pasca menyimpan admin di kolom cost — bukan
 *  modal prepaid — sehingga tidak pernah lolos filter r.cost <= 0. */
export type EffectivePascaProduct = PascaProduct & { active: boolean };

const g = globalThis as { __ktdTopupLive?: LiveCatalog };

/** Buang cache — dipanggil setiap kali override ditulis (sinkron/saklar). */
export function invalidateTopupCatalogCache(): void {
  delete g.__ktdTopupLive;
}

/** Katalog efektif: statis + override DB. Gagal baca DB TIDAK pernah
 *  melempar — fallback katalog statis (fail-open seperti pintu pra-bayar). */
async function effectiveCatalog(): Promise<LiveCatalog> {
  const cached = g.__ktdTopupLive;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;

  let overrides: TopupCatalogOverrideRow[];
  try {
    overrides = await listTopupCatalogOverrides();
  } catch (e) {
    console.warn("[topup-live] baca override gagal:", e);
    overrides = [];
  }
  const bySku = new Map(overrides.map((r) => [r.sku, r]));
  const staticSkus = new Set(TOPUP_PRODUCTS.map((p) => p.sku));
  const providerByBrand = new Map<string, TopUpProvider>();
  for (const p of TOPUP_PROVIDERS) {
    if (!providerByBrand.has(p.brand.toLowerCase())) providerByBrand.set(p.brand.toLowerCase(), p);
  }

  // Produk efektif: SKU statis dengan override diterapkan + SKU baru.
  const products: TopUpProduct[] = [];
  const dead = new Set<string>();
  for (const p of TOPUP_PRODUCTS) {
    const r = bySku.get(p.sku);
    if (r && r.active === 0) {
      dead.add(p.sku);
      continue;
    }
    const cost = r && r.cost > 0 ? r.cost : p.costPrice;
    products.push({
      ...p,
      costPrice: cost,
      sellPrice: r && r.cost > 0 ? sellFor(cost, p.category) : p.sellPrice,
    });
  }
  for (const r of overrides) {
    if (staticSkus.has(r.sku) || r.active === 0 || r.cost <= 0) continue;
    const prov = providerByBrand.get(r.brand.toLowerCase());
    if (!prov) continue; // brand tidak dijual — lewati
    const category = (CATEGORY_MAP[r.category] ?? prov.primaryCategory) as TopUpCategory;
    products.push({
      sku: r.sku,
      brand: prov.brand,
      name: r.name || r.sku,
      costPrice: r.cost,
      sellPrice: sellFor(r.cost, category),
      category,
      ...(prov.needsServer ? { needsServer: true } : {}),
      customerNoLabel: prov.customerNoLabel ?? TARGET_LABELS[category] ?? "Nomor HP",
    });
  }
  const prodBySku = new Map(products.map((p) => [p.sku, p]));

  // Provider efektif: nominal statis difilter/di-patch, SKU baru digabung
  // ke provider brand-nya, provider yang habis nominalnya dibuang.
  const providers: TopUpProvider[] = [];
  for (const sp of TOPUP_PROVIDERS) {
    const nominals: TopUpNominal[] = sp.nominals
      .filter((n) => prodBySku.has(n.sku) && !dead.has(n.sku))
      .map((n) => {
        const pr = prodBySku.get(n.sku) as TopUpProduct;
        return { ...n, costPrice: pr.costPrice, sellPrice: pr.sellPrice };
      });
    if (nominals.length === 0) continue;
    providers.push({ ...sp, nominals });
  }
  for (const r of overrides) {
    if (staticSkus.has(r.sku) || r.active === 0 || r.cost <= 0) continue;
    const target = providers.find((p) => p.brand.toLowerCase() === r.brand.toLowerCase());
    if (!target) continue;
    const pr = prodBySku.get(r.sku);
    if (!pr) continue;
    target.nominals.push({
      sku: r.sku,
      name: r.name || r.sku,
      type: r.type || "",
      costPrice: pr.costPrice,
      sellPrice: pr.sellPrice,
      category: pr.category,
    });
  }

  // Produk pasca efektif: override active=0 → disembunyikan; override cost
  // membawa admin terkini (sinkron cmd "pasca").
  const pasca: EffectivePascaProduct[] = [];
  for (const p of PASCA_PRODUCTS) {
    const r = bySku.get(p.sku);
    if (r && r.active === 0) continue;
    pasca.push({
      ...p,
      admin: r && r.cost > 0 ? r.cost : p.admin,
      active: true,
    });
  }

  const built: LiveCatalog = { at: Date.now(), products, providers, pasca };
  g.__ktdTopupLive = built;
  return built;
}

export async function getEffectiveTopupProducts(): Promise<TopUpProduct[]> {
  return (await effectiveCatalog()).products;
}

export async function getEffectiveTopupProviders(): Promise<TopUpProvider[]> {
  return (await effectiveCatalog()).providers;
}

export async function getEffectiveProductBySku(sku: string): Promise<TopUpProduct | undefined> {
  const { products } = await effectiveCatalog();
  return products.find((p) => p.sku === sku);
}

export async function getEffectivePascaProducts(): Promise<EffectivePascaProduct[]> {
  return (await effectiveCatalog()).pasca;
}

export async function getEffectivePascaBySku(
  sku: string,
): Promise<EffectivePascaProduct | undefined> {
  const { pasca } = await effectiveCatalog();
  return pasca.find((p) => p.sku === sku);
}

export async function getEffectiveProviderBySlug(slug: string): Promise<TopUpProvider | undefined> {
  const { providers } = await effectiveCatalog();
  return providers.find((p) => p.slug === slug);
}

export async function getEffectiveProviderForSku(sku: string): Promise<TopUpProvider | undefined> {
  const { providers } = await effectiveCatalog();
  return providers.find((p) => p.nominals.some((n) => n.sku === sku));
}

// ---------- Sinkron katalog otomatis ----------

export type CatalogSyncResult = {
  ok: boolean;
  detail: string;
  live: number;
  /** SKU mati/hilang → disembunyikan etalase + ditolak order. */
  hilang: number;
  /** SKU modal berubah → modal + harga jual diperbarui. */
  harga: number;
  /** Dari harga: kenaikan menembus batas max_price (+5%). */
  urgent: number;
  /** Nominal baru seller pada brand yang dijual → ditambahkan. */
  baru: number;
  /** Override dihapus (SKU pulih / kembali normal). */
  restored: number;
  /** Total baris override yang ditulis. */
  applied: number;
  notified: boolean;
  /** Bagian sinkron pascabayar (cmd "pasca") — bisa skipped (kuota/format). */
  pasca: {
    live: number;
    hilang: number;
    harga: number;
    skipped: boolean;
    detail: string;
  };
};

type LiveEntry = {
  price: number;
  active: boolean;
  brand: string;
  category: string;
  name: string;
  type: string;
  desc: string;
};

/** Batas minimal SKU live — respons di bawah ini dianggap terpotong dan
 *  sinkron DIBATALKAN demi keamanan (jangan sampai SKU sehat dinonaktifkan
 *  massal gara-gara respons parsial). */
const MIN_LIVE_SKUS = 1000;

/** Batas minimal SKU pasca live — akun kita 664; di bawah ini berarti
 *  respons terpotong dan bagian pasca dibatalkan (prepaid tetap jalan). */
const MIN_PASCA_SKUS = 400;

function fail(detail: string): CatalogSyncResult {
  return {
    ok: false,
    detail,
    live: 0,
    hilang: 0,
    harga: 0,
    urgent: 0,
    baru: 0,
    restored: 0,
    applied: 0,
    notified: false,
    pasca: { live: 0, hilang: 0, harga: 0, skipped: false, detail: "" },
  };
}

/** Tarik price-list live (atau pakai prefetched — hemat kuota Digiflazz),
 *  bandingkan dengan katalog efektif, lalu TULIS diff ke topup_catalog_live.
 *  Saklar manual (note='manual') tidak disentuh. Bila ada perubahan, WA
 *  laporan singkat ke owner. Tidak pernah melempar — kegagalan hanya
 *  dicatat dan dikembalikan sebagai ok:false. */
export async function syncTopupCatalog(
  prefetched?: unknown,
  prefetchedPasca?: unknown | null,
  notify = true,
): Promise<CatalogSyncResult> {
  let data: unknown = prefetched;
  if (data === undefined) {
    const r = await relayDigiflazz("price-list", buildPriceListPayload({ cmd: "prepaid" }));
    if (!r.ok) {
      return fail(`relay gagal: ${r.error ?? `HTTP ${r.status ?? "?"}`}`);
    }
    data = r.data;
  }
  if (!Array.isArray(data)) {
    // Mis. { rc: "83", message: "limitasi pengecekan pricelist" }.
    return fail("respons bukan daftar (kemungkinan limitasi rc=83) — sinkron ditunda");
  }
  if (data.length < MIN_LIVE_SKUS) {
    return fail(
      `respons mencurigakan (${data.length} SKU < ${MIN_LIVE_SKUS}) — sinkron dibatalkan demi keamanan`,
    );
  }

  const liveMap = new Map<string, LiveEntry>();
  for (const it of data as Array<Record<string, unknown>>) {
    const sku = String(it.buyer_sku_code ?? "");
    if (!sku) continue;
    liveMap.set(sku, {
      price: Number(it.price ?? 0) || 0,
      active: isTrue(it.buyer_product_status) && isTrue(it.seller_product_status),
      brand: String(it.brand ?? ""),
      category: String(it.category ?? ""),
      name: String(it.product_name ?? ""),
      type: String(it.type ?? ""),
      desc: String(it.desc ?? ""),
    });
  }

  const providerByBrand = new Map<string, TopUpProvider>();
  for (const p of TOPUP_PROVIDERS) {
    if (!providerByBrand.has(p.brand.toLowerCase())) providerByBrand.set(p.brand.toLowerCase(), p);
  }
  const staticSkus = new Set(TOPUP_PRODUCTS.map((p) => p.sku));

  let existing: TopupCatalogOverrideRow[];
  try {
    existing = await listTopupCatalogOverrides();
  } catch (e) {
    console.warn("[topup-live] baca override gagal:", e);
    existing = [];
  }
  const manualSkus = new Set(
    existing.filter((r) => r.note === "manual").map((r) => r.sku),
  );

  const rows: Array<{
    sku: string;
    active: number;
    cost: number;
    name: string;
    type: string;
    brand: string;
    category: string;
    note: string;
  }> = [];

  let hilang = 0;
  let harga = 0;
  let urgent = 0;
  let baru = 0;

  for (const p of TOPUP_PRODUCTS) {
    if (manualSkus.has(p.sku)) continue; // saklar manual dilindungi
    const l = liveMap.get(p.sku);
    if (!l || !l.active) {
      rows.push({
        sku: p.sku,
        active: 0,
        cost: l ? l.price : p.costPrice,
        name: p.name,
        type: "",
        brand: p.brand,
        category: p.category,
        note: "",
      });
      hilang++;
      continue;
    }
    if (l.price !== p.costPrice) {
      rows.push({
        sku: p.sku,
        active: 1,
        cost: l.price,
        name: p.name,
        type: "",
        brand: p.brand,
        category: p.category,
        note: "",
      });
      harga++;
      if (l.price > Math.ceil(p.costPrice * 1.05)) urgent++;
    }
  }

  for (const [sku, l] of liveMap) {
    if (staticSkus.has(sku) || manualSkus.has(sku) || !l.active) continue;
    const prov = providerByBrand.get(l.brand.toLowerCase());
    if (!prov) continue; // brand tidak dijual — lewati
    const category = CATEGORY_MAP[l.category] ?? prov.primaryCategory;
    if (!category) continue;
    rows.push({
      sku,
      active: 1,
      cost: l.price,
      name: shortNameFor(l.name, prov),
      type: nominalTagFor({ desc: l.desc, type: l.type, product_name: l.name }),
      brand: prov.brand,
      category,
      note: "baru",
    });
    baru++;
  }

  const computedSkus = new Set(rows.map((r) => r.sku));

  // ---- Bagian pascabayar: SKU pasca statis (PASCA_PRODUCTS) vs cmd "pasca".
  // Admin digiflazz tersimpan di kolom cost; SKU mati → active 0. Tidak ada
  // penambahan "baru" — SKU pasca baru harus lewat regen katalog.
  const pasca = { live: 0, hilang: 0, harga: 0, skipped: false, detail: "" };
  let pascaData: unknown = prefetchedPasca;
  if (pascaData === undefined) {
    const pr = await relayDigiflazz("price-list", buildPriceListPayload({ cmd: "pasca" }));
    if (!pr.ok || !Array.isArray(pr.data)) {
      pasca.skipped = true;
      pasca.detail = pr.ok
        ? "respons bukan daftar (kemungkinan limitasi rc=83)"
        : pr.error ?? `HTTP ${pr.status ?? "?"}`;
    } else {
      pascaData = pr.data;
    }
  }
  if (Array.isArray(pascaData)) {
    if (pascaData.length < MIN_PASCA_SKUS) {
      pasca.skipped = true;
      pasca.detail = `respons mencurigakan (${pascaData.length} < ${MIN_PASCA_SKUS}) — bagian pasca dibatalkan`;
    } else {
      const pLive = new Map<string, { admin: number; active: boolean }>();
      for (const it of pascaData as Array<Record<string, unknown>>) {
        const sku = String(it.buyer_sku_code ?? "");
        if (!sku) continue;
        pLive.set(sku, {
          admin: Number(it.admin ?? 0) || 0,
          active: isTrue(it.buyer_product_status) && isTrue(it.seller_product_status),
        });
      }
      pasca.live = pLive.size;
      for (const p of PASCA_PRODUCTS) {
        if (manualSkus.has(p.sku)) continue; // saklar manual dilindungi
        const l = pLive.get(p.sku);
        if (!l || !l.active) {
          rows.push({
            sku: p.sku,
            active: 0,
            cost: l ? l.admin : p.admin,
            name: p.name,
            type: "",
            brand: p.brand,
            category: p.category,
            note: "",
          });
          pasca.hilang++;
          continue;
        }
        if (l.admin !== p.admin) {
          rows.push({
            sku: p.sku,
            active: 1,
            cost: l.admin,
            name: p.name,
            type: "",
            brand: p.brand,
            category: p.category,
            note: "",
          });
          pasca.harga++;
        }
      }
    }
  }

  const restored = existing.filter((r) => r.note !== "manual" && !computedSkus.has(r.sku)).length;
  const changed = hilang + harga + baru + restored + pasca.hilang + pasca.harga > 0;

  try {
    await replaceTopupCatalogOverrides(rows);
    invalidateTopupCatalogCache();
  } catch (e) {
    return fail(`tulis override gagal: ${e instanceof Error ? e.message : String(e)}`);
  }

  const res: CatalogSyncResult = {
    ok: true,
    detail: "sinkron selesai",
    live: liveMap.size,
    hilang,
    harga,
    urgent,
    baru,
    restored,
    applied: rows.length,
    notified: false,
    pasca,
  };
  if (notify && changed) {
    try {
      await notifySync(res);
      res.notified = true;
    } catch (e) {
      console.warn("[topup-live] WA sinkron katalog gagal:", e);
    }
  }
  return res;
}

/** WA laporan singkat SETELAH sinkron diterapkan — bukan daftar yang
 *  menunggu tangan owner lagi. Harga jual dihitung ulang otomatis dengan
 *  margin standar, jadi laporan cukup ringkasan angka. */
async function notifySync(d: CatalogSyncResult): Promise<void> {
  const lines: string[] = ["[Top-up] Sinkron katalog otomatis — sudah diterapkan:"];
  if (d.hilang > 0) {
    lines.push(`- ${d.hilang} SKU mati dinonaktifkan (hilang dari etalase & ditolak saat order).`);
  }
  if (d.harga > 0) {
    lines.push(
      `- ${d.harga} SKU modal diperbarui${d.urgent > 0 ? ` (${d.urgent} di antaranya menembus batas max_price)` : ""}.`,
    );
  }
  if (d.baru > 0) {
    lines.push(`- ${d.baru} nominal baru ditambahkan ke etalase.`);
  }
  if (d.restored > 0) {
    lines.push(`- ${d.restored} SKU pulih → kembali ikut katalog statis.`);
  }
  if (d.pasca && !d.pasca.skipped) {
    const ph = d.pasca.hilang > 0 ? `, ${d.pasca.hilang} nonaktif` : "";
    const pa = d.pasca.harga > 0 ? `, ${d.pasca.harga} admin berubah` : "";
    lines.push(`- Bayar Tagihan: ${d.pasca.live} SKU aktif${ph}${pa}.`);
  } else if (d.pasca && d.pasca.skipped && d.pasca.detail) {
    lines.push(`- Bayar Tagihan tidak disinkron: ${d.pasca.detail}.`);
  }
  lines.push("Harga jual dihitung ulang otomatis (margin standar). Saklar manual admin tidak diubah.");
  await notifyTopupOwner(lines.join("\n"));
}
