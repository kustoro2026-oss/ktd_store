// Perawatan pesanan top-up: tandai pesanan gateway yang kedaluwarsa + cek
// ulang transaksi Digiflazz yang masih Pending (kirim ulang ref_id sama =
// idempoten). Dipanggil oleh:
//   - cron Vercel harian (vercel.json) dengan header x-cron-secret,
//   - tombol "Cek Ulang Pending" di /topup/admin dengan x-topup-secret,
//   - webhook iPaymu secara internal (tick latar belakang) — jalur tercepat,
//     karena Vercel Hobby hanya mengizinkan 1 cron/hari.

import { NextResponse } from "next/server";
import { expireStalePendingOrders } from "@/lib/db";
import { recheckPendingTopups } from "@/lib/topup-execute";

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

  const expired = await expireStalePendingOrders();
  const recheck = await recheckPendingTopups();
  return NextResponse.json({
    ok: true,
    expired,
    rechecked: recheck.checked,
    results: recheck.results,
  });
}
