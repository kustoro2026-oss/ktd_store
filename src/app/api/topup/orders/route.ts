// Daftar pesanan top-up terbaru untuk panel /topup/admin (dilindungi
// x-topup-secret — rahasia yang sama dengan endpoint eksekusi manual).

import { NextResponse } from "next/server";
import { listTopupOrders } from "@/lib/db";

export const runtime = "nodejs";

const ADMIN_SECRET = process.env.TOPUP_ADMIN_SECRET ?? "";

export async function GET(req: Request) {
  const secret = req.headers.get("x-topup-secret") ?? "";
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const orders = await listTopupOrders(20);
  return NextResponse.json({ ok: true, orders });
}
