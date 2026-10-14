// Proses pesanan top-up manual via WhatsApp (CS) — dua langkah:
// 1) pratinjau {orderId} menampilkan detail pesanan + saldo Digiflazz,
// 2) confirm:true menandai pesanan LUNAS (gateway_trx="manual") lalu
//    mengeksekusi top-up. Eksekusi memakai claim atomik di topup-execute.ts
//    sehingga aman dari transaksi ganda; status Pending dicek ulang dengan
//    ref_id yang sama (idempoten).
//
// Pembeli mengecek hasilnya di https://toko.kustoro2026.com/topup/cek-status.

import { NextResponse } from "next/server";
import { getTopupOrder, markOrderPaid, type TopUpOrder } from "@/lib/db";
import { executeTopupOrder, recheckTopupOrder } from "@/lib/topup-execute";
import { getBalance } from "@/lib/topup-balance";
import { formatRupiah } from "@/lib/topup";
import { adminGuard } from "@/lib/admin-guard";

export const runtime = "nodejs";

const ADMIN_SECRET = process.env.TOPUP_ADMIN_SECRET ?? "";

/** Proyeksi baris pesanan untuk halaman admin (tanpa kolom internal). */
const orderInfo = (o: TopUpOrder) => ({
  id: o.id,
  product_name: o.product_name,
  customer_no: o.customer_no,
  amount: o.amount,
  cost: o.cost,
  buyer_name: o.buyer_name,
  buyer_phone: o.buyer_phone,
  payment_status: o.payment_status,
  topup_status: o.topup_status,
  digiflazz_sn: o.digiflazz_sn,
  error_message: o.error_message,
  created_at: o.created_at,
});

export async function POST(req: Request) {
  const g = adminGuard(req, ADMIN_SECRET);
  if (g === "rate_limited") {
    return NextResponse.json(
      { ok: false, error: "Terlalu banyak percobaan. Silakan coba beberapa saat lagi." },
      { status: 429 },
    );
  }
  if (g !== "ok") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: { orderId?: unknown; confirm?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const orderId = String(body.orderId ?? "").trim().toUpperCase();
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "no_pesanan_wajib" }, { status: 400 });
  }

  const order = await getTopupOrder(orderId);
  if (!order) {
    return NextResponse.json(
      { ok: false, error: "pesanan_tidak_ditemukan" },
      { status: 404 },
    );
  }

  // ---- Pratinjau: detail pesanan + saldo, tanpa perubahan apa pun. ----
  const saldo = await getBalance(true);
  if (body.confirm !== true) {
    return NextResponse.json({
      ok: true,
      preview: true,
      order: orderInfo(order),
      saldo: saldo.ok
        ? { ok: true, balance: saldo.balance }
        : { ok: false, error: saldo.error ?? "tidak terbaca" },
      saldoCukup: saldo.ok && saldo.balance >= order.cost,
      catatan:
        saldo.ok && saldo.balance < order.cost
          ? `Saldo ${formatRupiah(saldo.balance)} kurang dari modal ${formatRupiah(
              order.cost,
            )} — pesanan tetap ditandai Lunas dan eksekusi ditunda otomatis sampai saldo cukup.`
          : null,
    });
  }

  // ---- Konfirmasi: tandai lunas (bila perlu) lalu eksekusi / cek ulang. ----
  if (order.payment_status !== "paid") {
    await markOrderPaid(order.id, "manual");
  }

  const fresh = await getTopupOrder(orderId);
  let outcome: { step: string; detail: string };
  if (!fresh) {
    return NextResponse.json({ ok: false, error: "pesanan_hilang" }, { status: 500 });
  }
  if (fresh.topup_status === "waiting_payment") {
    outcome = await executeTopupOrder(orderId);
  } else if (fresh.topup_status === "pending" || fresh.topup_status === "processing") {
    // Kirim ulang ref yang sama — idempoten, tidak membuat transaksi baru.
    outcome = await recheckTopupOrder(fresh);
  } else {
    outcome = {
      step: "skipped",
      detail: `top-up sudah ${fresh.topup_status} — tidak ada tindakan baru`,
    };
  }

  const after = await getTopupOrder(orderId);
  return NextResponse.json({
    ok: true,
    preview: false,
    step: outcome.step,
    detail: outcome.detail,
    order: after ? orderInfo(after) : orderInfo(order),
  });
}
