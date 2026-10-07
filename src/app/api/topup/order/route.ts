// Buat pesanan top-up: validasi SKU dari katalog (harga dihitung ulang
// server-side — harga dari klien diabaikan), simpan pesanan ke database,
// lalu buat sesi pembayaran Duitku. Bila gateway belum dikonfigurasi (atau
// gagal membuat sesi — termasuk nominal di bawah minimum Rp 10.000),
// pesanan tetap tersimpan dan pembeli diarahkan ke fallback WhatsApp (CS
// memverifikasi transfer manual lalu eksekusi dari /topup/admin).
//
// Body: { sku, id, server?, buyerName, buyerPhone }
// Respons: { ok, orderId, mode: "duitku" | "wa", paymentUrl?, waLink? }

import { NextResponse } from "next/server";
import { TOPUP_PRODUCTS, customerNoFor } from "@/lib/topup";
import { createTopupOrder, newOrderId, newRefId, setOrderPaymentSession } from "@/lib/db";
import { createDuitkuPayment, duitkuConfigured, DUITKU_MIN_AMOUNT } from "@/lib/duitku";
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

  if (duitkuConfigured()) {
    if (product.sellPrice < DUITKU_MIN_AMOUNT) {
      // Duitku menolak transaksi di bawah Rp 10.000 — arahkan ke WhatsApp.
      return NextResponse.json({
        ok: true,
        orderId,
        mode: "wa",
        waLink,
        gatewayError: `Nominal di bawah minimum Duitku (Rp ${DUITKU_MIN_AMOUNT.toLocaleString("id-ID")})`,
      });
    }
    const pay = await createDuitkuPayment({
      merchantOrderId: refId,
      productName: `${product.name} (${orderId})`,
      amount: product.sellPrice,
      buyerName,
      buyerPhone,
      returnUrl: `${SITE_URL}/topup/bayar/${orderId}`,
      callbackUrl: `${SITE_URL}/api/duitku/callback`,
      // QRIS (SP) default — inquiry memuat qrString yang dirender jadi QR
      // di halaman bayar tanpa redirect. Bila ditolak, coba VA.
      paymentMethod: "SP",
    });
    if (pay.ok && pay.paymentUrl) {
      await setOrderPaymentSession(
        orderId,
        pay.reference ?? "",
        pay.paymentUrl,
        pay.vaNumber ?? "",
        pay.qrString ?? "",
      );
      return NextResponse.json({
        ok: true,
        orderId,
        mode: "duitku",
        paymentUrl: pay.paymentUrl,
        qrString: pay.qrString ?? "",
        vaNumber: pay.vaNumber ?? "",
        channel: "SP",
      });
    }
    // QRIS ditolak? Coba VA sebagai fallback agar pembeli tetap bisa bayar
    // tanpa redirect (nomor VA ditampilkan langsung di halaman bayar).
    const payVa = await createDuitkuPayment({
      merchantOrderId: `${refId}-VA`,
      productName: `${product.name} (${orderId})`,
      amount: product.sellPrice,
      buyerName,
      buyerPhone,
      returnUrl: `${SITE_URL}/topup/bayar/${orderId}`,
      callbackUrl: `${SITE_URL}/api/duitku/callback`,
      paymentMethod: "VA",
    });
    if (payVa.ok && payVa.paymentUrl) {
      await setOrderPaymentSession(
        orderId,
        payVa.reference ?? "",
        payVa.paymentUrl,
        payVa.vaNumber ?? "",
        payVa.qrString ?? "",
      );
      return NextResponse.json({
        ok: true,
        orderId,
        mode: "duitku",
        paymentUrl: payVa.paymentUrl,
        qrString: payVa.qrString ?? "",
        vaNumber: payVa.vaNumber ?? "",
        channel: "VA",
      });
    }
    // Sesi gagal — pesanan tetap ada; pembeli lanjut via WhatsApp.
    return NextResponse.json({
      ok: true,
      orderId,
      mode: "wa",
      waLink,
      gatewayError: pay.error ?? "sesi Duitku gagal dibuat",
    });
  }

  return NextResponse.json({ ok: true, orderId, mode: "wa", waLink });
}
