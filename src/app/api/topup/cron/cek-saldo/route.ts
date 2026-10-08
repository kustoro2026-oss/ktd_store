// Pengecekan saldo Digiflazz terjadwal — kirim WA ke owner bila saldo turun
// di bawah ambang (TOPUP_LOW_BALANCE_THRESHOLD, default Rp 100.000).
// Dipanggil oleh:
//   - cron Vercel harian (vercel.json) dengan header x-cron-secret,
//   - admin /topup/admin dengan x-topup-secret (pemantauan manual).
// Saldo juga dicek setelah tiap transaksi sukses (topup-execute), jadi cron
// ini bertindak sebagai jaring pengaman harian.

import { NextResponse } from "next/server";
import { alertLowBalanceIfNeeded, getBalance, LOW_BALANCE_THRESHOLD } from "@/lib/topup-balance";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const ADMIN_SECRET = process.env.TOPUP_ADMIN_SECRET ?? "";

export async function GET(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  const adminSecret = req.headers.get("x-topup-secret") ?? "";
  const cronOk = CRON_SECRET && cronSecret === CRON_SECRET;
  const adminOk = ADMIN_SECRET && adminSecret === ADMIN_SECRET;
  if (!cronOk && !adminOk) {
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
  return NextResponse.json({
    ok: true,
    balance: bal.balance,
    threshold: LOW_BALANCE_THRESHOLD,
    alert,
  });
}
