// Buat pesanan top-up: validasi SKU dari katalog (harga dihitung ulang
// server-side — harga dari klien diabaikan), simpan pesanan ke database,
// lalu buat sesi pembayaran iPaymu. Bila gateway belum dikonfigurasi (atau
// gagal membuat sesi), pesanan tetap tersimpan dan pembeli diarahkan ke
// fallback WhatsApp (CS memverifikasi transfer manual lalu eksekusi dari
// /topup/admin).
//
// Body: { sku, id, server?, buyerName, buyerPhone }
// Respons: { ok, orderId, mode: "ipaymu" | "wa", paymentUrl?, waLink? }

import { NextResponse } from "next/server";
import { TOPUP_PRODUCTS, customerNoFor } from "@/lib/topup";
import { createTopupOrder, newOrderId, newRefId, setOrderPaymentSession } from "@/lib/db";
import { createIpaymuPayment, ipaymuConfigured } from "@/lib/ipaymu";
import { SITE_URL, whatsappLink } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: {
    sku?: unknown;
    id?: unknown;
    server?: unknown;
    buyerName?: unknown;
    buyerPhone?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const sku = String(body.sku ?? "").trim();
  const product = TOPUP_PRODUCTS.find((p) => p.sku === sku);
  if (!product) {
    return NextResponse.json({ ok: false, error: "sku_tidak_dikenal" }, { status: 400 });
  }

  const target = String(body.id ?? "").trim();
  if (!target) {
    return NextResponse.json(
      { ok: false, error: `isi ${product.customerNoLabel}` },
      { status: 400 },
    );
  }
  if (product.needsServer && !String(body.server ?? "").trim()) {
    return NextResponse.json({ ok: false, error: "server_wajib" }, { status: 400 });
  }
  const customerNo = customerNoFor(product, target, String(body.server ?? ""));

  const buyerName = String(body.buyerName ?? "").trim().slice(0, 100);
  const buyerPhone = String(body.buyerPhone ?? "").trim().slice(0, 20);

  const orderId = newOrderId();
  const refId = newRefId();

  try {
    await createTopupOrder({
      id: orderId,
      ref_id: refId,
      sku: product.sku,
      product_name: product.name,
      customer_no: customerNo,
      amount: product.sellPrice,
      cost: product.costPrice,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
    });
  } catch (e) {
    // Duplikat ref_id sangat jarang — cukup kirim error ke klien.
    return NextResponse.json(
      { ok: false, error: "gagal_menyimpan_pesanan", detail: String(e) },
      { status: 500 },
    );
  }

  const waLink = whatsappLink(
    [
      "Halo, saya sudah membuat pesanan top up:",
      "",
      `No. Pesanan: ${orderId}`,
      `Produk: ${product.name}`,
      `Tujuan: ${customerNo}`,
      `Total: Rp ${new Intl.NumberFormat("id-ID").format(product.sellPrice)}`,
      ...(buyerName ? [`Nama: ${buyerName}`] : []),
      ...(buyerPhone ? [`No. HP: ${buyerPhone}`] : []),
    ].join("\n"),
  );

  if (ipaymuConfigured()) {
    const pay = await createIpaymuPayment({
      referenceId: refId,
      productName: `${product.name} (${orderId})`,
      amount: product.sellPrice,
      buyerName,
      buyerPhone,
      returnUrl: `${SITE_URL}/topup/bayar/${orderId}`,
      cancelUrl: `${SITE_URL}/topup/bayar/${orderId}?dibatalkan=1`,
      notifyUrl: `${SITE_URL}/api/topup/pay/webhook`,
    });
    if (pay.ok && pay.sessionId && pay.paymentUrl) {
      await setOrderPaymentSession(orderId, pay.sessionId, pay.paymentUrl);
      return NextResponse.json({
        ok: true,
        orderId,
        mode: "ipaymu",
        paymentUrl: pay.paymentUrl,
      });
    }
    // Sesi gagal — pesanan tetap ada; pembeli lanjut via WhatsApp.
    return NextResponse.json({
      ok: true,
      orderId,
      mode: "wa",
      waLink,
      gatewayError: pay.error ?? "sesi iPaymu gagal dibuat",
    });
  }

  return NextResponse.json({ ok: true, orderId, mode: "wa", waLink });
}
