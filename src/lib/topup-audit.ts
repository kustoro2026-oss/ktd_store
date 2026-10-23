// Audit penyimpangan katalog vs price-list live Digiflazz (cron harian).
//
// Membandingkan TOPUP_PRODUCTS (katalog) dengan price-list prepaid live dan
// mengirim WA ke owner bila ada anomali yang bisa menolak pesanan:
//   - SKU katalog yang nonaktif/hilang di live (calon penolakan rc 43),
//   - harga live > modal katalog, terutama yang menembus max_price (+5%),
//   - nominal baru seller pada brand yang dijual (belum ada di katalog).
// Price-list kena limitasi (rc=83) tidak dianggap anomali — snapshot
// kesehatan tetap dipertahankan refreshHealthSnapshot, dan audit hari
// berikutnya mengulang. Kenaikan harga ringan (<= +5% modal) terserap
// otomatis oleh max_price, jadi hanya dihitung ringkas, tidak di-WA satu
// per satu (menghindari noise harian).

import { buildPriceListPayload, relayDigiflazz } from "./digiflazz";
import { TOPUP_PRODUCTS, TOPUP_PROVIDERS, formatRupiah } from "./topup";
import { notifyTopupOwner } from "./wa";

export type PriceGap = { sku: string; katalog: number; live: number };

export type CatalogDrift = {
  ok: boolean;
  detail: string;
  live: number;
  /** SKU katalog yang hilang/nonaktif di price-list live. */
  hilang: string[];
  /** Harga live naik tapi masih dalam batas max_price (+5%). */
  naik: PriceGap[];
  /** Harga live menembus max_price — transaksi akan ditolak. */
  urgent: PriceGap[];
  /** SKU live (aktif, brand dijual) yang belum ada di katalog. */
  baru: string[];
};

type LiveEntry = { price: number; active: boolean; brand: string };

/** Nilai kebenaran price-list bisa boolean `true` atau string "True". */
function isTrue(v: unknown): boolean {
  return String(v ?? "").toLowerCase() === "true";
}

const MAX_WA_ITEMS = 12;

function empty(detail: string): CatalogDrift {
  return { ok: false, detail, live: 0, hilang: [], naik: [], urgent: [], baru: [] };
}

function listPreview(items: string[]): string {
  const shown = items.slice(0, MAX_WA_ITEMS).join(", ");
  return items.length > MAX_WA_ITEMS ? `${shown} (+${items.length - MAX_WA_ITEMS} lainnya)` : shown;
}

/** Ambil price-list live (atau pakai hasil prefetched — menghemat kuota
 *  Digiflazz) lalu bandingkan dengan katalog. Bila ada anomali, kirim WA
 *  ringkas ke owner. Tidak pernah melempar — kegagalan hanya dicatat. */
export async function auditTopupCatalog(prefetched?: unknown): Promise<CatalogDrift> {
  let data: unknown = prefetched;
  if (data === undefined) {
    const r = await relayDigiflazz("price-list", buildPriceListPayload({ cmd: "prepaid" }));
    if (!r.ok) {
      return empty(`relay gagal: ${r.error ?? `HTTP ${r.status ?? "?"}`}`);
    }
    data = r.data;
  }
  if (!Array.isArray(data)) {
    // Mis. { rc: "83", message: "limitasi pengecekan pricelist" }.
    return empty("respons bukan daftar (kemungkinan limitasi rc=83) — audit ditunda");
  }

  const liveMap = new Map<string, LiveEntry>();
  for (const it of data as Array<Record<string, unknown>>) {
    const sku = String(it.buyer_sku_code ?? "");
    if (!sku) continue;
    // Generator katalog mensyaratkan buyer DAN seller aktif — audit harus
    // pakai syarat yang sama, kalau tidak SKU nonaktif sisi buyer lolos
    // dari deteksi dan baru ketahuan saat transaksi ditolak.
    liveMap.set(sku, {
      price: Number(it.price ?? 0) || 0,
      active: isTrue(it.buyer_product_status) && isTrue(it.seller_product_status),
      brand: String(it.brand ?? ""),
    });
  }

  const catalogSkus = new Set(TOPUP_PRODUCTS.map((p) => p.sku));
  const storeBrands = new Set(TOPUP_PROVIDERS.map((p) => p.brand));

  const hilang: string[] = [];
  const naik: PriceGap[] = [];
  const urgent: PriceGap[] = [];
  const baru: string[] = [];

  for (const p of TOPUP_PRODUCTS) {
    const l = liveMap.get(p.sku);
    if (!l || !l.active) {
      hilang.push(p.sku);
      continue;
    }
    if (l.price > p.costPrice) {
      const gap = { sku: p.sku, katalog: p.costPrice, live: l.price };
      if (l.price > Math.ceil(p.costPrice * 1.05)) urgent.push(gap);
      else naik.push(gap);
    }
  }
  for (const [sku, l] of liveMap) {
    if (catalogSkus.has(sku) || !l.active) continue;
    if (storeBrands.has(l.brand)) baru.push(sku);
  }

  const res: CatalogDrift = {
    ok: true,
    detail: "audit selesai",
    live: liveMap.size,
    hilang,
    naik,
    urgent,
    baru,
  };
  await maybeNotifyOwner(res);
  return res;
}

/** WA ke owner HANYA bila ada anomali yang butuh tindakan (hilang / urgent /
 *  baru). Kenaikan ringan hanya disebut jumlahnya — terserap max_price. */
async function maybeNotifyOwner(d: CatalogDrift): Promise<void> {
  if (d.hilang.length === 0 && d.urgent.length === 0 && d.baru.length === 0) return;
  const lines: string[] = ["[Top-up] Audit katalog harian — ada anomali:"];
  if (d.hilang.length > 0) {
    lines.push(`- ${d.hilang.length} SKU nonaktif/hilang: ${listPreview(d.hilang)}`);
  }
  if (d.urgent.length > 0) {
    const preview = d.urgent
      .slice(0, MAX_WA_ITEMS)
      .map((g) => `${g.sku} (${formatRupiah(g.katalog)} -> ${formatRupiah(g.live)})`)
      .join(", ");
    lines.push(
      `- ${d.urgent.length} SKU harga MENEMBUS batas max_price: ${preview}${
        d.urgent.length > MAX_WA_ITEMS ? ` (+${d.urgent.length - MAX_WA_ITEMS} lainnya)` : ""
      }`,
    );
  }
  if (d.baru.length > 0) {
    lines.push(`- ${d.baru.length} nominal baru seller: ${listPreview(d.baru)}`);
  }
  if (d.naik.length > 0) {
    lines.push(`- ${d.naik.length} SKU harga naik ringan (terserap max_price).`);
  }
  lines.push("Tindakan: node scripts/gen-topup-catalog.cjs untuk sinkronkan katalog.");
  try {
    await notifyTopupOwner(lines.join("\n"));
  } catch (e) {
    console.warn("[topup] WA audit katalog gagal:", e);
  }
}
