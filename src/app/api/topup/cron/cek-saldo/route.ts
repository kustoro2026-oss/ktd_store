// Pengecekan saldo Digiflazz terjadwal — kirim WA ke owner bila saldo turun
// di bawah ambang (TOPUP_LOW_BALANCE_THRESHOLD, default Rp 100.000).
// Sekaligus menyegarkan snapshot kesehatan produk (pintu pra-bayar) DAN
// MENSINKRONKAN katalog vs price-list live (SKU mati dinonaktifkan, modal
// diperbarui, nominal baru ditambahkan — otomatis, tanpa tangan owner) —
// satu panggilan price-list dari kuota Digiflazz yang terbatas (rc=83)
// untuk semua.
// Dipanggil oleh:
//   - cron Vercel harian (vercel.json) dengan header x-cron-secret,
//   - admin /topup/admin dengan x-topup-secret (pemantauan manual).
// Saldo juga dicek setelah tiap transaksi sukses (topup-execute), jadi cron
// ini bertindak sebagai jaring pengaman harian.

import { NextResponse } from "next/server";
import { alertLowBalanceIfNeeded, getBalance, LOW_BALANCE_THRESHOLD } from "@/lib/topup-balance";
import { refreshHealthSnapshot } from "@/lib/topup-health";
import { syncTopupCatalog } from "@/lib/topup-live";
import { buildPriceListPayload, relayDigiflazz } from "@/lib/digiflazz";
import { cronOrAdminGuard } from "@/lib/admin-guard";

export const runtime = "nodejs";

// Pull price-list penuh + audit katalog butuh lebih dari batas default —
// beri ruang eksekusi (di plan non-hobby dipakai penuh; di hobby Vercel
// tetap membatasi sesuai plan).
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const ADMIN_SECRET = process.env.TOPUP_ADMIN_SECRET ?? "";

export async function GET(req: Request) {
  const g = cronOrAdminGuard(req, CRON_SECRET, ADMIN_SECRET);
  if (g === "rate_limited") {
    return NextResponse.json(
      { ok: false, error: "Terlalu banyak percobaan. Silakan coba beberapa saat lagi." },
      { status: 429 },
    );
  }
  if (g !== "ok") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const bal = await getBalance(true);
  if (!bal.ok) {
    return NextResponse.json(
      { ok: false, error: "cek_saldo_gagal", detail: bal.error },
      { status: 502 },
    );
  }

  const alert = await alertLowBalanceIfNeeded(bal.balance);

  // Segarkan snapshot kesehatan produk + sinkronkan katalog — after() lama
  // terbukti tidak tereksekusi di produksi (snapshot membeku), dan kegagalan
  // hanya dicatat, tidak menggagalkan respons cron. Price-list ditarik SEKALI
  // lalu dipakai bersama (kuota Digiflazz terbatas, rc=83).
  let sync: Awaited<ReturnType<typeof syncTopupCatalog>> | null = null;
  try {
    const pr = await relayDigiflazz("price-list", buildPriceListPayload({ cmd: "prepaid" }));
    const prefetched = pr.ok ? pr.data : undefined;
    if (!pr.ok) console.warn("[topup] price-list gagal:", pr.error ?? `HTTP ${pr.status ?? "?"}`);
    try {
      const h = await refreshHealthSnapshot(prefetched);
      if (!h.ok) console.warn("[topup] refresh snapshot kesehatan:", h.detail);
    } catch (e) {
      console.warn("[topup] refresh snapshot kesehatan gagal:", e);
    }
    try {
      sync = await syncTopupCatalog(prefetched);
      if (!sync.ok) console.warn("[topup] sinkron katalog:", sync.detail);
    } catch (e) {
      console.warn("[topup] sinkron katalog gagal:", e);
    }
  } catch (e) {
    console.warn("[topup] price-list gagal total:", e);
  }

  return NextResponse.json({
    ok: true,
    balance: bal.balance,
    threshold: LOW_BALANCE_THRESHOLD,
    alert,
    sync: sync
      ? {
          detail: sync.detail,
          live: sync.live,
          hilang: sync.hilang,
          harga: sync.harga,
          urgent: sync.urgent,
          baru: sync.baru,
          restored: sync.restored,
          applied: sync.applied,
          notified: sync.notified,
        }
      : null,
  });
}
