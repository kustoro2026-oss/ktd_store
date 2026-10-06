// Webhook pembayaran iPaymu.
//
// iPaymu mengirim POST dengan header X-Signature (HMAC-SHA256 atas JSON
// kunci terurut dari body yang sudah dinormalisasi tipenya, secret = NOMOR
// VA) — lihat src/lib/ipaymu.ts. Balas HTTP 200 ("Success") agar iPaymu
// berhenti retry; signature tidak valid dibalas 400.
//
// Alur: verifikasi → cocokkan reference_id ke pesanan → tandai dibayar →
// eksekusi otomatis (cek saldo → transaksi Digiflazz → WA). Eksekusi
// idempoten — claim atomik di db.ts mencegah transaksi ganda bila iPaymu
// retry. Setelah itu, jalankan cek ulang Pending di latar belakang (after)
// sebagai tick kesempatan kedua (cron Vercel Hobby hanya 1x/hari).

import { after } from "next/server";
import {
  getTopupOrderByRef,
  markOrderPaid,
  markOrderPaymentEnded,
} from "@/lib/db";
import { verifyIpaymuCallback } from "@/lib/ipaymu";
import { executeTopupOrder, recheckPendingTopups } from "@/lib/topup-execute";

export const runtime = "nodejs";

const SUCCESS = new Response("Success", { status: 200 });

export async function POST(req: Request) {
  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") ?? "";
  const signature = req.headers.get("x-signature") ?? "";

  const cb = await verifyIpaymuCallback(rawBody, contentType, signature);
  if (!cb.ok || !cb.referenceId) {
    return new Response("Invalid Signature", { status: 400 });
  }

  const order = await getTopupOrderByRef(cb.referenceId);
  if (!order) {
    // Ref tidak dikenal (mungkin callback milik fitur lain) — akhiri retry.
    return SUCCESS;
  }

  const statusText = (cb.status ?? "").toLowerCase();
  const isSuccess = statusText === "berhasil" || cb.statusCode === 1;
  const isEnded =
    statusText === "expired" ||
    statusText === "dibatalkan" ||
    statusText === "cancel" ||
    cb.statusCode === -2;

  if (isSuccess) {
    await markOrderPaid(order.id, cb.trxId ?? "", cb.paidAt || undefined);
    // Eksekusi inline — total roundtrip Digiflazz singkat; bila terpotong
    // timeout, retry iPaymu masuk ke claim yang sama (idempoten).
    await executeTopupOrder(order.id);
  } else if (isEnded) {
    await markOrderPaymentEnded(order.id, "expired", "Pembayaran kedaluwarsa");
  }
  // Status lain (pending) dibiarkan — iPaymu akan mengirim callback lagi
  // saat status berubah.

  // Tick kesempatan kedua: cek ulang transaksi Pending tanpa menunggu cron.
  after(async () => {
    try {
      await recheckPendingTopups();
    } catch {
      // Latar belakang — kegagalan tidak perlu mengganggu callback.
    }
  });

  return SUCCESS;
}
