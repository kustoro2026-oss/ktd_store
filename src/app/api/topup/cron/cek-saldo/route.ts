// Pengecekan saldo Digiflazz terjadwal — logika penuh di @/lib/topup-daily
// (runDailyTopupMaintenance), dipakai bersama cron Vercel & worker VPS.
// Dipanggil oleh:
//   - cron Vercel harian (vercel.json) dengan header x-cron-secret,
//   - admin /topup/admin dengan x-topup-secret (pemantauan manual).
// Saldo juga dicek setelah tiap transaksi sukses (topup-execute), jadi cron
// ini bertindak sebagai jaring pengaman harian.

import { NextResponse } from "next/server";
import { runDailyTopupMaintenance } from "@/lib/topup-daily";
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

  const res = await runDailyTopupMaintenance();
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.error ?? "cek_saldo_gagal", detail: res.detail },
      { status: 502 },
    );
  }
  return NextResponse.json(res);
}
