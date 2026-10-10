// Pemantauan saldo Digiflazz: cache singkat untuk gate sebelum pembayaran,
// dan peringatan WA ke owner saat saldo turun di bawah ambang (cooldown
// mencegah spam bila banyak transaksi beruntun).
//
// Ambang bisa diatur lewat env TOPUP_LOW_BALANCE_THRESHOLD (default
// Rp 100.000). Cache & cooldown in-memory — serverless boleh amnesia di
// cold start, paling buruk peringatan terkirim ganda.

import { checkDigiflazzBalance } from "./digiflazz";
import { formatRupiah } from "./topup";
import { notifyTopupOwner } from "./wa";

const parsed = Number(process.env.TOPUP_LOW_BALANCE_THRESHOLD ?? "100000");
export const LOW_BALANCE_THRESHOLD = Number.isFinite(parsed) && parsed > 0 ? parsed : 100000;

const CACHE_TTL_MS = 60_000;
const ALERT_COOLDOWN_MS = 3 * 60 * 60 * 1000;

let cache: { at: number; balance: number } | null = null;
let lastAlertAt = 0;

export type BalanceInfo = { ok: boolean; balance: number; error?: string };

/** Baca saldo Digiflazz dengan cache 60 detik (gate pembayaran) — `force`
 *  melewati cache untuk pembacaan pasca-transaksi yang harus akurat. */
export async function getBalance(force = false): Promise<BalanceInfo> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { ok: true, balance: cache.balance };
  }
  const res = await checkDigiflazzBalance();
  if (!res.ok) {
    return { ok: false, balance: 0, error: res.error };
  }
  cache = { at: Date.now(), balance: res.balance };
  return { ok: true, balance: res.balance };
}

/** Catat saldo terkini ke cache — dipakai setelah transaksi sukses supaya
 *  gate pembayaran pesanan berikutnya tidak membaca saldo pra-transaksi
 *  yang basi (cache TTL 60 detik). */
export function recordBalance(balance: number): void {
  cache = { at: Date.now(), balance };
}

/** Gate sebelum membuat sesi pembayaran online: pastikan saldo cukup untuk
 *  cost produk. Fail-open bila saldo tidak bisa dibaca (relay down) —
 *  eksekusi nanti tetap punya pengaman saldo sendiri. */
export async function gateBalanceForCost(
  cost: number,
): Promise<{ ok: boolean; balance: number | null }> {
  const bal = await getBalance();
  if (!bal.ok) return { ok: true, balance: null };
  if (bal.balance < cost) return { ok: false, balance: bal.balance };
  return { ok: true, balance: bal.balance };
}

/** Peringatkan owner bila saldo di bawah ambang — dikirim maksimal sekali
 *  per cooldown. Dipanggil setelah transaksi sukses dan cron harian. */
export async function alertLowBalanceIfNeeded(balance: number): Promise<string | null> {
  if (balance >= LOW_BALANCE_THRESHOLD) return null;
  const now = Date.now();
  if (now - lastAlertAt < ALERT_COOLDOWN_MS) return "ditahan cooldown";
  lastAlertAt = now;
  return notifyTopupOwner(
    [
      "[Top-up] Peringatan saldo Digiflazz:",
      `Saldo tersisa ${formatRupiah(balance)} — di bawah ambang ${formatRupiah(LOW_BALANCE_THRESHOLD)}.`,
      "Segera deposit agar pesanan tidak terblokir.",
    ].join("\n"),
  );
}
