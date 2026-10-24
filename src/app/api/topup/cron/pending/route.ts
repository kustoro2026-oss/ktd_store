// Perawatan pesanan top-up — logika penuh di @/lib/topup-daily
// (runDailyPendingMaintenance), dipakai bersama cron Vercel & worker VPS.
// Dipanggil oleh:
//   - cron Vercel harian (vercel.json) dengan header x-cron-secret,
//   - tombol "Cek Ulang Pending" di /topup/admin dengan x-topup-secret,
//   - webhook Duitku secara internal (tick latar belakang) — jalur tercepat,
//     karena Vercel Hobby hanya mengizinkan 1 cron/hari.

import { NextResponse } from "next/server";
import { runDailyPendingMaintenance } from "@/lib/topup-daily";
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

  const res = await runDailyPendingMaintenance();
  return NextResponse.json({
    ok: true,
    expired: res.expired,
    rechecked: res.checked,
    results: res.results,
  });
}
