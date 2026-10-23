// Pengecekan saldo Digiflazz terjadwal — kirim WA ke owner bila saldo turun
// di bawah ambang (TOPUP_LOW_BALANCE_THRESHOLD, default Rp 100.000).
// Sekaligus menyegarkan snapshot kesehatan produk (pintu pra-bayar) DAN
// mengaudit penyimpangan katalog vs price-list live — satu panggilan
// price-list dari kuota Digiflazz yang terbatas (rc=83) untuk semua.
// Dipanggil oleh:
//   - cron Vercel harian (vercel.json) dengan header x-cron-secret,
//   - admin /topup/admin dengan x-topup-secret (pemantauan manual).
// Saldo juga dicek setelah tiap transaksi sukses (topup-execute), jadi cron
// ini bertindak sebagai jaring pengaman harian.

import { NextResponse } from "next/server";
import { alertLowBalanceIfNeeded, getBalance, LOW_BALANCE_THRESHOLD } from "@/lib/topup-balance";
import { refreshHealthSnapshot } from "@/lib/topup-health";
import { auditTopupCatalog } from "@/lib/topup-audit";
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

  // Segarkan snapshot kesehatan produk + audit katalog sinkron — after() lama
  // terbukti tidak tereksekusi di produksi (snapshot membeku), dan kegagalan
  // hanya dicatat, tidak menggagalkan respons cron. Price-list ditarik SEKALI
  // lalu dipakai bersama (kuota Digiflazz terbatas, rc=83).
  let audit: Awaited<ReturnType<typeof auditTopupCatalog>> | null = null;
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
      audit = await auditTopupCatalog(prefetched);
      if (!audit.ok) console.warn("[topup] audit katalog:", audit.detail);
    } catch (e) {
      console.warn("[topup] audit katalog gagal:", e);
    }
  } catch (e) {
    console.warn("[topup] price-list gagal total:", e);
  }

  return NextResponse.json({
    ok: true,
    balance: bal.balance,
    threshold: LOW_BALANCE_THRESHOLD,
    alert,
    audit: audit
      ? {
          detail: audit.detail,
          live: audit.live,
          hilang: audit.hilang.length,
          naik: audit.naik.length,
          urgent: audit.urgent.length,
          baru: audit.baru.length,
        }
      : null,
  });
}
