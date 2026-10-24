// Perawatan harian top-up — dipakai bersama cron Vercel & worker VPS supaya
// satu sumber logika:
//  - runDailyTopupMaintenance: cek saldo Digiflazz (WA owner bila di bawah
//    ambang) + segarkan snapshot kesehatan produk + sinkronkan katalog vs
//    price-list live. Price-list ditarik SEKALI lalu dipakai bersama karena
//    kuota Digiflazz terbatas (rc=83).
//  - runDailyPendingMaintenance: tandai pesanan gateway kedaluwarsa + cek
//    ulang transaksi Digiflazz yang masih Pending (kirim ulang ref_id sama =
//    idempoten).
import { alertLowBalanceIfNeeded, getBalance, LOW_BALANCE_THRESHOLD } from "@/lib/topup-balance";
import { refreshHealthSnapshot } from "@/lib/topup-health";
import { syncTopupCatalog } from "@/lib/topup-live";
import { buildPriceListPayload, relayDigiflazz } from "@/lib/digiflazz";
import { expireStalePendingOrders } from "@/lib/db";
import { recheckPendingTopups } from "@/lib/topup-execute";

export type DailyTopupResult = {
  ok: boolean;
  error?: string;
  detail?: string;
  balance?: number;
  threshold?: number;
  alert?: Awaited<ReturnType<typeof alertLowBalanceIfNeeded>>;
  sync?: Awaited<ReturnType<typeof syncTopupCatalog>> | null;
};

/** Cek saldo + snapshot kesehatan + sinkron katalog (jaring pengaman harian). */
export async function runDailyTopupMaintenance(): Promise<DailyTopupResult> {
  const bal = await getBalance(true);
  if (!bal.ok) {
    return { ok: false, error: "cek_saldo_gagal", detail: bal.error };
  }

  const alert = await alertLowBalanceIfNeeded(bal.balance);

  // Segarkan snapshot kesehatan produk + sinkronkan katalog — kegagalan
  // hanya dicatat, tidak menggagalkan hasil keseluruhan.
  let sync: Awaited<ReturnType<typeof syncTopupCatalog>> | null = null;
  try {
    const pr = await relayDigiflazz("price-list", buildPriceListPayload({ cmd: "prepaid" }));
    const prefetched = pr.ok ? pr.data : undefined;
    if (!pr.ok) console.warn("[topup] price-list gagal:", pr.error ?? `HTTP ${pr.status ?? "?"}`);
    // Price-list pasca (cmd "pasca") — kegagalan hanya melewati bagian pasca
    // (null = jangan tarik ulang di dalam sinkron; undefined = tarik internal).
    let prefetchedPasca: unknown | null = undefined;
    try {
      const pp = await relayDigiflazz("price-list", buildPriceListPayload({ cmd: "pasca" }));
      prefetchedPasca = pp.ok && Array.isArray(pp.data) ? pp.data : null;
      if (!pp.ok) console.warn("[topup] price-list pasca gagal:", pp.error ?? `HTTP ${pp.status ?? "?"}`);
    } catch (e) {
      prefetchedPasca = null;
      console.warn("[topup] price-list pasca gagal total:", e);
    }
    try {
      const h = await refreshHealthSnapshot(prefetched);
      if (!h.ok) console.warn("[topup] refresh snapshot kesehatan:", h.detail);
    } catch (e) {
      console.warn("[topup] refresh snapshot kesehatan gagal:", e);
    }
    try {
      sync = await syncTopupCatalog(prefetched, prefetchedPasca);
      if (!sync.ok) console.warn("[topup] sinkron katalog:", sync.detail);
    } catch (e) {
      console.warn("[topup] sinkron katalog gagal:", e);
    }
  } catch (e) {
    console.warn("[topup] price-list gagal total:", e);
  }

  return {
    ok: true,
    balance: bal.balance,
    threshold: LOW_BALANCE_THRESHOLD,
    alert,
    sync,
  };
}

export type DailyPendingResult = {
  expired: Awaited<ReturnType<typeof expireStalePendingOrders>>;
  checked: Awaited<ReturnType<typeof recheckPendingTopups>>["checked"];
  results: Awaited<ReturnType<typeof recheckPendingTopups>>["results"];
};

/** Kedaluwarsakan pesanan menggantung + cek ulang transaksi Pending. */
export async function runDailyPendingMaintenance(): Promise<DailyPendingResult> {
  const expired = await expireStalePendingOrders();
  const recheck = await recheckPendingTopups();
  return {
    expired,
    checked: recheck.checked,
    results: recheck.results,
  };
}
