// Cek status & riwayat pesanan top-up (publik — diakses dari halaman
// /topup/cek-status).
//
// GET /api/topup/cek?order=<ID pesanan>   → status satu pesanan
// GET /api/topup/cek?phone=<nomor HP>     → riwayat pesanan (maks 20)
//
// Nomor tujuan pembeli di-mask sebelum dikirim; data pribadi lain (nama,
// nomor HP pembeli, ref internal) tidak pernah dikirim.

import { NextResponse } from "next/server";
import { getTopupOrder, listTopupOrdersByPhone, type TopUpOrder } from "@/lib/db";

export const runtime = "nodejs";

/** "0812xxxx" → "08••••xx12" — aman untuk ditampilkan ke publik. */
function maskTarget(s: string): string {
  const t = s.trim();
  if (!t) return "-";
  if (t.length <= 4) return "••••";
  return t.slice(0, 2) + "••••" + t.slice(-4);
}

function displayStatus(o: TopUpOrder): {
  key: "menunggu" | "diproses" | "sukses" | "gagal";
  label: string;
} {
  if (o.topup_status === "success") return { key: "sukses", label: "Sukses" };
  if (o.topup_status === "failed") return { key: "gagal", label: "Gagal" };
  if (o.payment_status === "paid") return { key: "diproses", label: "Diproses" };
  if (o.payment_status === "expired" || o.payment_status === "failed") {
    return { key: "gagal", label: "Kedaluwarsa / Gagal" };
  }
  return { key: "menunggu", label: "Menunggu Bayar" };
}

/** Bentuk publik satu pesanan — tanpa data sensitif. */
function publicOrder(o: TopUpOrder) {
  return {
    id: o.id,
    product: o.product_name,
    target: maskTarget(o.customer_no),
    amount: o.amount,
    status: displayStatus(o),
    createdAt: o.created_at,
    canPay: o.payment_status === "pending",
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = (url.searchParams.get("order") ?? "").trim();
  const phone = (url.searchParams.get("phone") ?? "").trim();

  if (orderId) {
    const order = await getTopupOrder(orderId);
    if (!order) {
      return NextResponse.json({ ok: false, error: "pesanan_tidak_ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, order: publicOrder(order) });
  }

  if (phone) {
    const orders = await listTopupOrdersByPhone(phone, 20);
    return NextResponse.json({ ok: true, orders: orders.map(publicOrder) });
  }

  return NextResponse.json(
    { ok: false, error: "isi order atau phone" },
    { status: 400 },
  );
}
