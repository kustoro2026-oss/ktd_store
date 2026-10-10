// Pintu cek kesehatan produk sebelum pembayaran (snapshot).
//
// Digiflazz MEMBATASI pengecekan price-list (rc=83 "limitasi pengecekan
// pricelist"), jadi status produk TIDAK BOLEH dicek per pesanan. Sebagai
// gantinya snapshot SKU yang sedang "Gangguan" disegarkan berkala (cron
// harian + piggyback saat konsol admin membuka price-list) dan disimpan di
// tabel topup_health_snapshot; gate per pesanan hanya membaca tabel itu
// (cepat, tanpa API, tanpa risiko limit).
//
// Fail-open: SKU tanpa baris snapshot, baris basi (> 48 jam), atau
// kegagalan baca DB TIDAK memblokir pesanan — pintu ini hanya menahan
// gangguan yang terkonfirmasi dan segar.

import {
  buildPriceListPayload,
  relayDigiflazz,
} from "./digiflazz";
import {
  getHealthSnapshot,
  replaceHealthSnapshot,
} from "./db";

/** Umur maksimal baris gangguan yang masih dianggap valid (jam). */
const HEALTH_MAX_AGE_HOURS = 48;

export type ProductHealthGate = {
  ok: boolean;
  /** "gangguan" = terblokir, "sehat" / "unknown" = lolos. */
  status: "gangguan" | "sehat" | "unknown";
  detail: string;
};

type PriceListItem = {
  buyer_sku_code?: unknown;
  seller_product_status?: unknown;
  seller_name?: unknown;
};

/** Ambil price-list prepaid penuh lalu tulis ulang snapshot: hanya SKU
 *  berstatus selain "True" yang disimpan (tabel kecil). Bila Digiflazz
 *  menolak (rc=83 limit) atau respons tidak berbentuk daftar, snapshot lama
 *  dipertahankan. `prefetched` dipakai piggyback (mis. konsol admin yang
 *  sudah menarik price-list) supaya kuota Digiflazz tidak terpakai dua kali. */
export async function refreshHealthSnapshot(
  prefetched?: unknown,
): Promise<{
  ok: boolean;
  items: number;
  gangguan: number;
  detail: string;
}> {
  let data: unknown = prefetched;
  if (data === undefined) {
    const r = await relayDigiflazz("price-list", buildPriceListPayload({ cmd: "prepaid" }));
    if (!r.ok) {
      return {
        ok: false,
        items: 0,
        gangguan: 0,
        detail: `relay gagal: ${r.error ?? `HTTP ${r.status ?? "?"}`}`,
      };
    }
    data = r.data;
  }
  if (!Array.isArray(data)) {
    // Mis. { rc: "83", message: "limitasi pengecekan pricelist" } — jaga
    // snapshot lama, jangan pernah menimpanya dengan data tak berbentuk.
    return {
      ok: false,
      items: 0,
      gangguan: 0,
      detail: "respons bukan daftar (kemungkinan limitasi Digiflazz) — snapshot dipertahankan",
    };
  }
  const list = data as PriceListItem[];
  const gangguan = list
    .filter((p) => {
      const s = String(p.seller_product_status ?? "").toLowerCase();
      return s !== "" && s !== "true";
    })
    .map((p) => ({
      sku: String(p.buyer_sku_code ?? ""),
      status: String(p.seller_product_status ?? ""),
      seller: String(p.seller_name ?? ""),
    }))
    .filter((p) => p.sku !== "");
  try {
    await replaceHealthSnapshot(gangguan);
  } catch (e) {
    return {
      ok: false,
      items: list.length,
      gangguan: gangguan.length,
      detail: `gagal menulis snapshot: ${String(e)}`,
    };
  }
  return {
    ok: true,
    items: list.length,
    gangguan: gangguan.length,
    detail: "snapshot diperbarui",
  };
}

/** Gate pra-pembayaran untuk satu SKU. Hanya memblokir bila baris snapshot
 *  menyatakan gangguan DAN masih segar (<= 48 jam). */
export async function gateProductHealth(sku: string): Promise<ProductHealthGate> {
  try {
    const row = await getHealthSnapshot(sku);
    if (!row) return { ok: true, status: "sehat", detail: "tidak ada catatan gangguan" };
    // Baris basi = refresh sudah lama gagal — jangan blokir selamanya.
    const ageMs = Date.now() - Date.parse(row.updated_at.replace(" ", "T") + "Z");
    if (!Number.isFinite(ageMs) || ageMs > HEALTH_MAX_AGE_HOURS * 3600_000) {
      return { ok: true, status: "unknown", detail: `catatan gangguan basi (${row.updated_at})` };
    }
    if (String(row.status).toLowerCase() !== "true") {
      return {
        ok: false,
        status: "gangguan",
        detail: `produk gangguan (${row.status}, seller ${row.seller || "?"})`,
      };
    }
    return { ok: true, status: "sehat", detail: "status normal" };
  } catch (e) {
    // Fail-open — kesalahan baca DB tidak boleh menahan pembeli.
    return { ok: true, status: "unknown", detail: `gate gagal: ${String(e)}` };
  }
}
