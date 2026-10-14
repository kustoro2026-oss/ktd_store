// Pengecekan saldo Digiflazz terjadwal — kirim WA ke owner bila saldo turun
// di bawah ambang (TOPUP_LOW_BALANCE_THRESHOLD, default Rp 100.000).
// Sekaligus menyegarkan snapshot kesehatan produk (pintu pra-bayar) — dua
// pekerjaan dalam satu jadwal, dan harga satu panggilan price-list dari
// kuota Digiflazz yang terbatas (rc=83).
// Dipanggil oleh:
//   - cron Vercel harian (vercel.json) dengan header x-cron-secret,
//   - admin /topup/admin dengan x-topup-secret (pemantauan manual).
// Saldo juga dicek setelah tiap transaksi sukses (topup-execute), jadi cron
// ini bertindak sebagai jaring pengaman harian.

import { NextResponse } from "next/server";
import { alertLowBalanceIfNeeded, getBalance, LOW_BALANCE_THRESHOLD } from "@/lib/topup-balance";
import { refreshHealthSnapshot } from "@/lib/topup-health";
import { cronOrAdminGuard } from "@/lib/admin-guard";

export const runtime = "nodejs";

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

  // Segarkan snapshot kesehatan produk sinkron — after() lama terbukti tidak
  // tereksekusi di produksi (snapshot membeku), dan kegagalan refresh hanya
  // dicatat, tidak menggagalkan respons cron.
  try {
    const h = await refreshHealthSnapshot();
    if (!h.ok) console.warn("[topup] refresh snapshot kesehatan:", h.detail);
  } catch (e) {
    console.warn("[topup] refresh snapshot kesehatan gagal:", e);
  }

  return NextResponse.json({
    ok: true,
    balance: bal.balance,
    threshold: LOW_BALANCE_THRESHOLD,
    alert,
  });
}
