// Cek saldo Digiflazz untuk halaman admin /topup/admin.
// Header wajib: x-topup-secret (nilai TOPUP_ADMIN_SECRET).
// Logika cek saldo tunggal ada di src/lib/digiflazz.ts
// (checkDigiflazzBalance) — payload & signature TIDAK diduplikasi di sini
// agar tidak drift dengan jalur gate/eksekusi.

import { NextResponse } from "next/server";
import { checkDigiflazzBalance, digiflazzConfigured } from "@/lib/digiflazz";
import { adminGuard } from "@/lib/admin-guard";

export const runtime = "nodejs";

const ADMIN_SECRET = process.env.TOPUP_ADMIN_SECRET ?? "";

export async function GET(req: Request) {
  const g = adminGuard(req, ADMIN_SECRET);
  if (g === "rate_limited") {
    return NextResponse.json(
      { ok: false, error: "Terlalu banyak percobaan. Silakan coba beberapa saat lagi." },
      { status: 429 },
    );
  }
  if (g !== "ok") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!digiflazzConfigured()) {
    return NextResponse.json({ ok: false, error: "config_missing" }, { status: 500 });
  }

  const bal = await checkDigiflazzBalance();
  if (!bal.ok) {
    return NextResponse.json(
      { ok: false, error: "cek_saldo_gagal", detail: bal.error },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, balance: bal.balance });
}
