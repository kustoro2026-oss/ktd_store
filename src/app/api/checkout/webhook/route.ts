// Webhook Duitku untuk pesanan checkout toko (produk fisik).
//
// Duitku mengirim POST x-www-form-urlencoded dengan resultCode ("00" sukses,
// "01" gagal) dan signature = HMAC-SHA256(merchantCode + amount +
// merchantOrderId) — verifikasi di src/lib/duitku.ts. Balas 200 "OK" agar
// retry Duitku berhenti; signature tidak valid dibalas 400.
//
// Alur: verifikasi → cocokkan merchantOrderId (= ref_id) ke pesanan →
// tandai lunas → NOTIFIKASI OTOMATIS ke WA bot: pemilik menerima detail
// pesanan lengkap (produk, alamat, kurir, total, bukti bayar berupa
// reference Duitku) tanpa pembeli perlu mengirim bukti transfer manual.

import {
  getStoreOrderByRef,
  markStoreOrderFailed,
  markStoreOrderPaid,
  type StoreOrderItem,
} from "@/lib/db";
import { verifyDuitkuCallback } from "@/lib/duitku";
import { notifyTopupBuyer, notifyTopupOwner } from "@/lib/wa";

export const runtime = "nodejs";

const OK = new Response("OK", { status: 200 });

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

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

export async function POST(req: Request) {
  const rawBody = await req.text();

  const cb = verifyDuitkuCallback(rawBody);
  if (!cb.ok || !cb.merchantOrderId) {
    return new Response("Bad Signature", { status: 400 });
  }

  const order = await getStoreOrderByRef(cb.merchantOrderId);
  if (!order) {
    // Ref tidak dikenal (mungkin callback milik fitur lain) — akhiri retry.
    return OK;
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

  return OK;
}
