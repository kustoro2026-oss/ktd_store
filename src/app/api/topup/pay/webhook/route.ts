// Webhook pembayaran Duitku.
//
// Duitku mengirim POST x-www-form-urlencoded ke callbackUrl dengan
// resultCode ("00" sukses, "01" gagal) dan signature = HMAC-SHA256 atas
// merchantCode + amount + merchantOrderId (kunci = API key) — lihat
// src/lib/duitku.ts. Balas HTTP 200 ("OK") agar Duitku berhenti retry;
// signature tidak valid dibalas 400.
//
// Alur: verifikasi → cocokkan merchantOrderId (= ref_id) ke pesanan →
// tandai dibayar → eksekusi otomatis (cek saldo → transaksi Digiflazz →
// WA). Eksekusi idempoten — claim atomik di db.ts mencegah transaksi ganda
// bila Duitku retry. Setelah itu, jalankan cek ulang Pending di latar
// belakang (after) sebagai tick kesempatan kedua (cron Vercel Hobby hanya
// 1x/hari).

import { after } from "next/server";
import {
  getTopupOrderByRef,
  markOrderPaid,
  markOrderPaymentEnded,
} from "@/lib/db";
import { verifyDuitkuCallback } from "@/lib/duitku";
import { executeTopupOrder, recheckPendingTopups } from "@/lib/topup-execute";

export const runtime = "nodejs";

const OK = new Response("OK", { status: 200 });

export async function POST(req: Request) {
  const rawBody = await req.text();

  const cb = verifyDuitkuCallback(rawBody);
  if (!cb.ok || !cb.merchantOrderId) {
    return new Response("Bad Signature", { status: 400 });
  }

  const order = await getTopupOrderByRef(cb.merchantOrderId);
  if (!order) {
    // Ref tidak dikenal (mungkin callback milik fitur lain) — akhiri retry.
    return OK;
  }

  if (cb.resultCode === "00") {
    await markOrderPaid(order.id, cb.reference ?? "");
    // Eksekusi inline — total roundtrip Digiflazz singkat; bila terpotong
    // timeout, retry Duitku masuk ke claim yang sama (idempoten).
    await executeTopupOrder(order.id);
  } else if (cb.resultCode === "01") {
    await markOrderPaymentEnded(order.id, "failed", "Pembayaran gagal");
  }
  // resultCode lain dibiarkan — Duitku akan mengirim callback lagi saat
  // status berubah.

  // Tick kesempatan kedua: cek ulang transaksi Pending tanpa menunggu cron.
  after(async () => {
    try {
      await recheckPendingTopups();
    } catch {
      // Latar belakang — kegagalan tidak perlu mengganggu callback.
    }
  });

  return OK;
}
