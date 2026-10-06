// Status pesanan top-up — dipakai halaman /topup/bayar/[id] untuk polling
// tiap 5 detik. Data yang dikembalikan aman ditampilkan ke pembeli (tanpa
// kolom internal seperti cost).

import { NextResponse } from "next/server";
import { getTopupOrder } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const order = await getTopupOrder(id);
    if (!order) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        product_name: order.product_name,
        customer_no: order.customer_no,
        amount: order.amount,
        buyer_name: order.buyer_name,
        payment_status: order.payment_status,
        topup_status: order.topup_status,
        payment_url: order.payment_url,
        paid_at: order.paid_at,
        digiflazz_sn: order.digiflazz_sn,
        error_message: order.error_message,
        created_at: order.created_at,
      },
    });
  } catch (e) {
    // Database belum terhubung (mis. DATABASE_URL belum diatur) — jangan
    // kirim 500 polos; halaman bayar cukup mengulang polling berikutnya.
    console.error("GET /api/topup/order/[id] error:", e);
    return NextResponse.json(
      { ok: false, error: "gagal_muat_pesanan" },
      { status: 500 },
    );
  }
}
