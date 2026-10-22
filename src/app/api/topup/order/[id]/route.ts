// Status pesanan top-up — dipakai halaman /topup/bayar/[id] untuk polling
// tiap 5 detik. Data yang dikembalikan aman ditampilkan ke pembeli (tanpa
// kolom internal seperti cost).

import { NextResponse } from "next/server";
import { getTopupOrder } from "@/lib/db";
import { getDuitkuPaymentMethods, paymentExpiryInfo } from "@/lib/duitku";

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
    // Nama & logo kanal yang benar-benar dipakai — dari daftar metode Duitku
    // (di-cache 10 menit per nominal) agar halaman bayar bisa menampilkan
    // logo bank saat VA tanpa memanggil gateway setiap polling.
    let channelName = "";
    let channelImage = "";
    if (order.payment_channel) {
      const methods = await getDuitkuPaymentMethods(order.amount);
      const method = methods.find((m) => m.code === order.payment_channel);
      if (method) {
        channelName = method.name;
        channelImage = method.image;
      }
    }
    // Masa berlaku pembayaran — QRIS 15 menit, kanal lama mengikuti aturannya
    // sendiri. Dihitung server-side agar hitungan di halaman tidak bergantung
    // pada jam perangkat pembeli.
    const expiry = paymentExpiryInfo(order.created_at, order.payment_channel);
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
        payment_va: order.payment_va,
        payment_qr: order.payment_qr,
        payment_channel: order.payment_channel,
        channel_name: channelName,
        channel_image: channelImage,
        expires_at: expiry.expiresAt,
        expires_in: expiry.expiresIn,
        paid_at: order.paid_at,
        digiflazz_sn: order.digiflazz_sn,
        error_message: order.error_message,
        // Jumlah percobaan eksekusi pasca-bayar (visibilitas untuk admin/hub
        // saat mengecek pesanan yang gagal transien lalu dicoba ulang).
        exec_attempts: order.exec_attempts,
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
