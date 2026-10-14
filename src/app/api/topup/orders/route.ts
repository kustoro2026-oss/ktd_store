// Daftar pesanan top-up terbaru untuk panel /topup/admin (dilindungi
// x-topup-secret — rahasia yang sama dengan endpoint eksekusi manual).

import { NextResponse } from "next/server";
import { listTopupOrders } from "@/lib/db";
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
  const orders = await listTopupOrders(20);
  return NextResponse.json({ ok: true, orders });
}
