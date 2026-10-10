// Router callback Duitku TERPADU — SATU URL untuk semua fitur di project:
// pesanan toko (produk fisik) dan top-up game. Duitku memanggil callbackUrl
// yang dikirim tiap inquiry; kedua fitur kini mengirim URL yang sama
// (/api/duitku/callback), lalu router ini mengecek ref_id (= merchantOrderId)
// ke tabel store_orders lalu topup_orders dan menjalankan handler yang cocok.
//
// Endpoint lama (/api/checkout/webhook dan /api/topup/pay/webhook) tetap
// aktif dan mendelegasikan ke router yang sama agar transaksi lama tidak
// pernah kehilangan callback.

import { after } from "next/server";
import {
  getStoreOrderByRef,
  getTopupOrderByRef,
  markOrderPaid,
  markOrderPaymentEnded,
  markStoreOrderFailed,
  markStoreOrderPaid,
  type StoreOrderItem,
} from "@/lib/db";
import { verifyDuitkuCallback, type DuitkuCallback } from "@/lib/duitku";
import { executeTopupOrder, recheckPendingTopups } from "@/lib/topup-execute";
import { notifyTopupBuyer, notifyTopupOwner } from "@/lib/wa";

const OK = new Response("OK", { status: 200 });

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

// ---------- pesanan toko (produk fisik) ----------

function orderLines(o: {
  id: string;
  items: string;
  buyer_name: string;
  buyer_phone: string;
  address: string;
  note: string;
  district_label: string;
  shipping_label: string;
  total: number;
  gateway_trx: string;
}): { owner: string; buyer: string } {
  let items: StoreOrderItem[] = [];
  try {
    items = JSON.parse(o.items) as StoreOrderItem[];
  } catch {
    items = [];
  }
  const itemText = items
    .map((it) => `- ${it.name}${it.qty > 1 ? ` (×${it.qty})` : ""} = ${rupiah(it.price * it.qty)}`)
    .join("\n");

  const owner = [
    "🛒 Pesanan Baru — LUNAS via Duitku",
    `No. Pesanan: ${o.id}`,
    "",
    itemText,
    "",
    `Nama: ${o.buyer_name}`,
    ...(o.buyer_phone ? [`HP: ${o.buyer_phone}`] : []),
    `Alamat: ${o.address}${o.district_label ? `, ${o.district_label}` : ""}`,
    ...(o.note ? [`Catatan: ${o.note}`] : []),
    `Kirim: ${o.shipping_label || "-"}`,
    `Total: ${rupiah(o.total)}`,
    `Ref Duitku: ${o.gateway_trx || "-"}`,
  ].join("\n");

  const buyer = [
    "Halo, pembayaran pesanan Anda di KTD Store sudah kami terima ✅",
    "",
    `No. Pesanan: ${o.id}`,
    `Total: ${rupiah(o.total)}`,
    "",
    "Pesanan sedang kami proses dan akan dikirim ke alamat yang Anda isi.",
    "Terima kasih sudah belanja di KTD Store!",
  ].join("\n");

  return { owner, buyer };
}

/** Handler pesanan toko — mengembalikan true bila ref cocok dengan tabel. */
async function handleStoreOrderCallback(cb: DuitkuCallback): Promise<boolean> {
  const order = await getStoreOrderByRef(cb.merchantOrderId!);
  if (!order) return false;

  // Guard nominal: callback harus senilai total pesanan. Bila berbeda
  // (pembayaran parsial / data tidak sinkron), jangan tandai lunas — log +
  // WA owner untuk cek manual. Signature Duitku sudah diverifikasi, jadi
  // mismatch ini bukan spoofing melainkan indikasi bug alur amount.
  if (cb.amount !== order.total) {
    console.error(
      `[checkout] callback ${order.id} amount ${cb.amount} != total ${order.total} — tidak ditandai lunas`,
    );
    await notifyTopupOwner(
      `[Checkout] Callback Duitku pesanan ${order.id} nominal ${rupiah(cb.amount ?? 0)} TIDAK sama dengan total ${rupiah(order.total)} — cek manual di Duitku.`,
    );
    return true;
  }

  if (cb.resultCode === "00") {
    const paid = order.payment_status !== "paid";
    await markStoreOrderPaid(order.id, cb.reference ?? "");
    // Notifikasi otomatis ke WA bot menggantikan kirim-bukti-manual: detail
    // pesanan + alamat ke owner, konfirmasi ke pembeli (bila nomor ada).
    if (paid) {
      const lines = orderLines({ ...order, gateway_trx: cb.reference ?? "" });
      const results = await Promise.allSettled([
        notifyTopupOwner(lines.owner),
        order.buyer_phone ? notifyTopupBuyer(order.buyer_phone, lines.buyer) : Promise.resolve("dilewati"),
      ]);
      // Log hasil untuk pemantauan — tidak mengubah respons ke Duitku.
      console.log(
        `[checkout] ${order.id} lunas — notif owner=${String(results[0].status)}, buyer=${String(results[1].status)}`,
      );
    }
  } else if (cb.resultCode === "01") {
    await markStoreOrderFailed(order.id, "Pembayaran gagal");
  }
  // resultCode lain dibiarkan — Duitku mengirim callback lagi saat status berubah.
  return true;
}

// ---------- top-up game ----------

/** Handler pesanan top-up — mengembalikan true bila ref cocok dengan tabel. */
async function handleTopupOrderCallback(cb: DuitkuCallback): Promise<boolean> {
  const order = await getTopupOrderByRef(cb.merchantOrderId!);
  if (!order) return false;

  // Guard nominal: callback harus senilai jumlah tagihan. Bila berbeda,
  // jangan tandai lunas / eksekusi — log + WA owner untuk cek manual.
  if (cb.amount !== order.amount) {
    console.error(
      `[topup] callback ${order.id} amount ${cb.amount} != tagihan ${order.amount} — tidak dieksekusi`,
    );
    await notifyTopupOwner(
      `[Top-up] Callback Duitku pesanan ${order.id} nominal ${rupiah(cb.amount ?? 0)} TIDAK sama dengan tagihan ${rupiah(order.amount)} — cek manual di Duitku.`,
    );
    return true;
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

  return true;
}

// ---------- router ----------

/** Titik masuk semua webhook Duitku: verifikasi → dispatch ke fitur yang
 *  cocok berdasarkan ref_id. Balas 200 "OK" agar retry Duitku berhenti. */
export async function routeDuitkuCallback(rawBody: string): Promise<Response> {
  const cb = verifyDuitkuCallback(rawBody);
  if (!cb.ok || !cb.merchantOrderId) {
    return new Response("Bad Signature", { status: 400 });
  }

  // Pesanan toko dicek dulu, lalu top-up — ref_id unik lintas tabel.
  // Fallback kanal sempat memakai akhiran "-VA" pada merchantOrderId
  // (bug lama); normalisasi ini memastikan callback lama tetap cocok
  // dengan ref_id asli bila Duitku mengirim ulang.
  const refs = [
    ...new Set([cb.merchantOrderId, cb.merchantOrderId.replace(/-VA$/i, "")]),
  ];
  for (const ref of refs) {
    const probe = { ...cb, merchantOrderId: ref };
    if (await handleStoreOrderCallback(probe)) return OK;
    if (await handleTopupOrderCallback(probe)) return OK;
  }

  // Ref tidak dikenal (mungkin callback milik fitur lain) — akhiri retry.
  return OK;
}
