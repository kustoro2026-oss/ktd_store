// Lanjut bayar pesanan pasca hasil inquiry: buat sesi pembayaran Duitku
// (QRIS) dengan merchantOrderId = ref_id pesanan (SAMA dengan ref inquiry
// Digiflazz — dipakai ulang untuk pay-pasca), lalu arahkan pembeli ke
// /topup/bayar/{orderId}. Jumlah tagihan diambil dari baris pesanan yang
// dibuat saat inquiry — angka dari klien diabaikan.
//
// Body: { orderId, buyerName?, buyerPhone? }
// Respons: { ok, orderId, mode: "duitku" | "wa", paymentUrl?, qrString?, ... }

import { NextResponse } from "next/server";
import { formatRupiah } from "@/lib/topup";
import { PASCA_SKUS } from "@/lib/topup-pasca";
import { getTopupOrder, setOrderPaymentSession, updateOrderBuyer } from "@/lib/db";
import {
  activeQrisCodes,
  createDuitkuPayment,
  duitkuConfigured,
  DUITKU_MIN_AMOUNT,
  QRIS_EXPIRY_MINUTES,
} from "@/lib/duitku";
import { gateBalanceForCost } from "@/lib/topup-balance";
import { notifyTopupOwner } from "@/lib/wa";
import { clientIp, rateLimitHit } from "@/lib/rate-limit";
import { SITE_URL, whatsappLink } from "@/lib/config";

export const runtime = "nodejs";

/** Sesi inquiry kedaluwarsa setelah 30 menit — tagihan bisa berubah, dan
 *  ref_id terikat inquiry sehingga harus cek ulang dari awal. */
const INQUIRY_TTL_MS = 30 * 60_000;

export async function POST(req: Request) {
  if (rateLimitHit(`topup-pasca-order:${clientIp(req)}`, 10 * 60_000, 10)) {
    return NextResponse.json(
      { ok: false, error: "Terlalu banyak percobaan. Silakan coba beberapa saat lagi." },
      { status: 429 },
    );
  }

  let body: { orderId?: unknown; buyerName?: unknown; buyerPhone?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const orderId = String(body.orderId ?? "").trim();
  const order = await getTopupOrder(orderId);
  if (!order || !PASCA_SKUS.has(order.sku)) {
    return NextResponse.json(
      { ok: false, error: "pesanan_tidak_ditemukan" },
      { status: 404 },
    );
  }
  if (order.payment_status !== "pending" || order.topup_status !== "waiting_payment") {
    return NextResponse.json(
      {
        ok: false,
        error: "pesanan_tidak_bisa_dibayar",
        message: "Pesanan sudah dibayar atau tidak dapat dilanjutkan.",
      },
      { status: 400 },
    );
  }
  const createdMs = Date.parse(order.created_at.replace(" ", "T") + "Z");
  if (!Number.isNaN(createdMs) && Date.now() - createdMs > INQUIRY_TTL_MS) {
    return NextResponse.json(
      {
        ok: false,
        error: "tagihan_kedaluwarsa",
        message: "Sesi cek tagihan sudah kedaluwarsa. Silakan cek ulang tagihan Anda.",
      },
      { status: 400 },
    );
  }

  const buyerName = String(body.buyerName ?? "").trim().slice(0, 100);
  const buyerPhone = String(body.buyerPhone ?? "").trim().slice(0, 20);
  if (buyerName || buyerPhone) {
    try {
      await updateOrderBuyer(orderId, buyerName, buyerPhone);
    } catch {
      // Data pembeli adalah pelengkap — kegagalan tidak menggagalkan bayar.
    }
  }

  // Notifikasi WA ke owner: ada pesanan tagihan baru. Kegagalan WA tidak
  // boleh menggagalkan alur bayar.
  try {
    const r = await notifyTopupOwner(
      [
        "[Top-up] Pesanan bayar tagihan baru:",
        `No. Pesanan: ${order.id}`,
        `Produk: ${order.product_name}`,
        `Tujuan: ${order.customer_no}`,
        `Total: ${formatRupiah(order.amount)}`,
        ...(order.note ? [`${order.note}`] : []),
        ...(buyerName ? [`Nama: ${buyerName}`] : []),
        ...(buyerPhone ? [`No. HP: ${buyerPhone}`] : []),
        "Status: menunggu pembayaran",
      ].join("\n"),
    );
    console.log(`[topup] ${order.id} WA owner saat bayar tagihan: ${r}`);
  } catch {
    // Notifikasi gagal tidak boleh menggagalkan alur bayar.
  }

  const waLink = whatsappLink(
    [
      "Halo, saya ingin membayar tagihan:",
      "",
      `No. Pesanan: ${order.id}`,
      `Produk: ${order.product_name}`,
      `Tujuan: ${order.customer_no}`,
      `Total: Rp ${new Intl.NumberFormat("id-ID").format(order.amount)}`,
      ...(buyerName ? [`Nama: ${buyerName}`] : []),
      ...(buyerPhone ? [`No. HP: ${buyerPhone}`] : []),
    ].join("\n"),
  );

  if (duitkuConfigured()) {
    if (order.amount < DUITKU_MIN_AMOUNT) {
      return NextResponse.json({
        ok: true,
        orderId: order.id,
        mode: "wa",
        waLink,
        gatewayError: `Pembayaran online tersedia untuk nominal minimal Rp ${DUITKU_MIN_AMOUNT.toLocaleString("id-ID")} — nominal ini belum dapat dibeli melalui halaman.`,
      });
    }
    // Gate saldo: jangan buat sesi bayar bila saldo Digiflazz tidak cukup
    // untuk membayar tagihan ini (fail-open saat relay down).
    const gate = await gateBalanceForCost(order.cost);
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: "layanan_sibuk" },
        { status: 503 },
      );
    }
    // QRIS saja, prioritas aktif (SQ → SP → NQ) — identik alur prabayar.
    const attempts = await activeQrisCodes();
    let pay: Awaited<ReturnType<typeof createDuitkuPayment>> | null = null;
    let payChannel = "";
    for (const code of attempts) {
      const attempt = await createDuitkuPayment({
        merchantOrderId: order.ref_id,
        productName: `${order.product_name} (${order.id})`,
        amount: order.amount,
        buyerName,
        buyerPhone,
        returnUrl: `${SITE_URL}/topup/bayar/${order.id}`,
        callbackUrl: `${SITE_URL}/api/duitku/callback`,
        paymentMethod: code,
        expiryMinutes: QRIS_EXPIRY_MINUTES,
      });
      if (attempt.ok) {
        pay = attempt;
        payChannel = code;
        break;
      }
      pay = attempt; // simpan error terakhir untuk gatewayError
    }
    if (pay?.ok && (pay.paymentUrl || pay.qrString || pay.vaNumber)) {
      await setOrderPaymentSession(
        order.id,
        pay.reference ?? "",
        pay.paymentUrl ?? "",
        pay.vaNumber ?? "",
        pay.qrString ?? "",
        payChannel,
      );
      return NextResponse.json({
        ok: true,
        orderId: order.id,
        mode: "duitku",
        paymentUrl: pay.paymentUrl,
        qrString: pay.qrString ?? "",
        vaNumber: pay.vaNumber ?? "",
        channel: payChannel,
        expires_in: QRIS_EXPIRY_MINUTES * 60,
        sandbox: process.env.DUITKU_SANDBOX === "true",
      });
    }
    return NextResponse.json({
      ok: true,
      orderId: order.id,
      mode: "wa",
      waLink,
      gatewayError:
        pay?.error ??
        "Pembayaran QRIS sedang tidak tersedia. Silakan hubungi CS kami melalui WhatsApp — CS siap memandu pembayaran hingga selesai.",
    });
  }

  return NextResponse.json({ ok: true, orderId: order.id, mode: "wa", waLink });
}
