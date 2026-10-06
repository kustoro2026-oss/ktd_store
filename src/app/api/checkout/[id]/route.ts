// Status pesanan checkout — dipolling modal pembayaran Duitku (4 detik).
// Status lunas ditulis webhook Duitku (/api/checkout/webhook).
import { NextResponse } from "next/server";
import { getStoreOrder, type StoreOrder } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const order = await getStoreOrder(id);
    if (!order) {
      return NextResponse.json({ ok: false, error: "tidak_ditemukan" }, { status: 404 });
    }
    // Kirim hanya field yang aman ditampilkan ke pembeli.
    const view: Pick<
      StoreOrder,
      "id" | "payment_status" | "total" | "error_message" | "payment_method"
    > = {
      id: order.id,
      payment_status: order.payment_status,
      total: order.total,
      error_message: order.error_message,
      payment_method: order.payment_method,
    };
    return NextResponse.json({ ok: true, order: view });
  } catch {
    return NextResponse.json(
      { ok: false, error: "gagal_muat_pesanan" },
      { status: 500 },
    );
  }
}
