// Eksekusi otomatis top-up setelah pembayaran terverifikasi.
//
// Alur: cek saldo Digiflazz ≥ cost → transaksi via relay → update status
// pesanan → notifikasi WA ke pembeli (dan owner bila gagal). Transaksi yang
// masuk status Pending dicek ulang lewat cron / klik admin dengan ref_id
// yang sama (idempoten — tidak ada transaksi ganda).

import {
  claimTopupExecution,
  finishTopup,
  getTopupOrder,
  listPendingTopups,
  type TopUpOrder,
} from "./db";
import { checkDigiflazzBalance, digiflazzTopup } from "./digiflazz";
import { formatRupiah } from "./topup";
import { notifyTopupBuyer, notifyTopupOwner } from "./wa";
import { whatsappDisplay } from "./config";

export type ExecuteStep =
  | "not_found"
  | "skipped"
  | "config_missing"
  | "balance_low"
  | "success"
  | "pending"
  | "failed";

export type ExecuteOutcome = {
  step: ExecuteStep;
  detail: string;
  /** Keterangan hasil kirim WA (untuk log admin), bila ada. */
  wa?: string;
};

const cs = whatsappDisplay();

/** Jalankan eksekusi otomatis satu pesanan (diklaim atomik — aman dipanggil
 *  berulang oleh webhook retry / cron / admin tanpa transaksi ganda). */
export async function executeTopupOrder(
  orderId: string,
  opts: { testing?: boolean } = {},
): Promise<ExecuteOutcome> {
  const order = await claimTopupExecution(orderId);
  if (!order) {
    const existing = await getTopupOrder(orderId);
    if (!existing) return { step: "not_found", detail: "pesanan tidak ditemukan" };
    return {
      step: "skipped",
      detail: `status ${existing.topup_status}/${existing.payment_status} — dilewati (sudah diproses atau belum lunas)`,
    };
  }
  try {
    return await runExecution(order, opts.testing === true);
  } catch (e) {
    await finishTopup(order.id, "failed", "", String(e));
    await notifyTopupOwner(
      `[Top-up] Pesanan ${order.id} GAGAL dieksekusi (error tak terduga). Cek /topup/admin.`,
    );
    return { step: "failed", detail: String(e) };
  }
}

async function runExecution(order: TopUpOrder, testing: boolean): Promise<ExecuteOutcome> {
  // 1. Cek saldo ≥ harga beli.
  const bal = await checkDigiflazzBalance();
  if (!bal.ok) {
    await finishTopup(order.id, "failed", "", `Cek saldo gagal: ${bal.error}`);
    const wa = await notifyTopupOwner(
      `[Top-up] Pesanan ${order.id} (${order.product_name}) butuh tindakan — cek saldo Digiflazz gagal (${bal.error}). Cek /topup/admin.`,
    );
    return { step: "failed", detail: `cek saldo gagal: ${bal.error}`, wa };
  }
  if (bal.balance < order.cost) {
    await finishTopup(order.id, "failed", "", "Saldo Digiflazz kurang");
    const wa = await notifyTopupOwner(
      `[Top-up] Saldo Digiflazz kurang untuk pesanan ${order.id}: tersisa ${formatRupiah(bal.balance)}, butuh ${formatRupiah(order.cost)}. Deposit dulu, lalu eksekusi ulang di /topup/admin.`,
    );
    return {
      step: "balance_low",
      detail: `saldo ${formatRupiah(bal.balance)} < cost ${formatRupiah(order.cost)}`,
      wa,
    };
  }

  // 2. Eksekusi transaksi Digiflazz.
  const res = await digiflazzTopup({
    sku: order.sku,
    customerNo: order.customer_no,
    refId: order.ref_id,
    testing,
  });
  if (!res.ok) {
    // Relay gagal — transaksi mungkin belum sampai Digiflazz; biarkan status
    // "processing" supaya cron mengecek ulang (kirim ulang ref sama).
    await finishTopup(order.id, "pending", "", `relay: ${res.error ?? "tidak terjangkau"}`);
    const wa = await notifyTopupOwner(
      `[Top-up] Pesanan ${order.id} (${order.product_name}) menunggu cek ulang — relay Digiflazz gagal (${res.error}). Cron akan mencoba lagi.`,
    );
    return { step: "pending", detail: `relay gagal, ditunda: ${res.error}`, wa };
  }

  // 3. Petakan status Digiflazz.
  if (res.success) {
    await finishTopup(order.id, "success", res.sn);
    const wa = await notifyTopupBuyer(
      order.buyer_phone,
      [
        `Halo ${order.buyer_name || "Kak"}, top up kamu berhasil!`,
        `Pesanan: ${order.id}`,
        `Produk: ${order.product_name}`,
        `Tujuan: ${order.customer_no}`,
        ...(res.sn ? [`SN: ${res.sn}`] : []),
        "",
        "Terima kasih sudah belanja di KTD Store.",
      ].join("\n"),
    );
    return { step: "success", detail: `sukses ${res.sn ? `(SN ${res.sn})` : ""}`, wa };
  }

  if (res.pending) {
    await finishTopup(order.id, "pending", "", res.message || "status Pending Digiflazz");
    const wa = await notifyTopupBuyer(
      order.buyer_phone,
      [
        `Halo ${order.buyer_name || "Kak"}, pembayaran top up kamu sudah kami terima dan sedang diproses.`,
        `Pesanan: ${order.id}`,
        `Produk: ${order.product_name}`,
        "",
        "Kami kabari lagi setelah top up selesai.",
      ].join("\n"),
    );
    return { step: "pending", detail: res.message || "Pending", wa };
  }

  // Gagal (rc lain / status Gagal).
  const reason = res.message || res.status || "ditolak Digiflazz";
  await finishTopup(order.id, "failed", "", reason);
  const wa = await notifyTopupBuyer(
    order.buyer_phone,
    [
      `Halo ${order.buyer_name || "Kak"}, maaf top up kamu belum berhasil (${reason}).`,
      `Pesanan: ${order.id}`,
      `Produk: ${order.product_name}`,
      "",
      `Hubungi CS kami ${cs} untuk cek ulang atau pengembalian dana.`,
    ].join("\n"),
  );
  await notifyTopupOwner(
    `[Top-up] Pesanan ${order.id} (${order.product_name}, ${formatRupiah(order.amount)}) GAGAL: ${reason}. Tindak lanjut refund via CS.`,
  );
  return { step: "failed", detail: reason, wa };
}

/** Cek ulang pesanan berstatus Pending dengan mengirim ulang ref_id yang
 *  sama ke Digiflazz (idempoten — mengembalikan status terkini). */
export async function recheckTopupOrder(order: TopUpOrder): Promise<ExecuteOutcome> {
  const res = await digiflazzTopup({
    sku: order.sku,
    customerNo: order.customer_no,
    refId: order.ref_id,
  });
  if (!res.ok) {
    // Relay belum terjangkau — pertahankan status pending untuk ronde berikut.
    return { step: "pending", detail: `relay: ${res.error ?? "tidak terjangkau"}` };
  }
  if (res.success) {
    await finishTopup(order.id, "success", res.sn);
    const wa = await notifyTopupBuyer(
      order.buyer_phone,
      [
        `Halo ${order.buyer_name || "Kak"}, kabar baik — top up kamu sudah selesai diproses!`,
        `Pesanan: ${order.id}`,
        `Produk: ${order.product_name}`,
        `Tujuan: ${order.customer_no}`,
        ...(res.sn ? [`SN: ${res.sn}`] : []),
        "",
        "Terima kasih sudah belanja di KTD Store.",
      ].join("\n"),
    );
    return { step: "success", detail: `sukses ${res.sn ? `(SN ${res.sn})` : ""}`, wa };
  }
  if (res.pending) {
    return { step: "pending", detail: res.message || "masih Pending" };
  }
  const reason = res.message || res.status || "ditolak Digiflazz";
  await finishTopup(order.id, "failed", "", reason);
  const wa = await notifyTopupBuyer(
    order.buyer_phone,
    [
      `Halo ${order.buyer_name || "Kak"}, maaf top up kamu belum berhasil (${reason}).`,
      `Pesanan: ${order.id}`,
      `Produk: ${order.product_name}`,
      "",
      `Hubungi CS kami ${cs} untuk cek ulang atau pengembalian dana.`,
    ].join("\n"),
  );
  await notifyTopupOwner(
    `[Top-up] Pesanan ${order.id} (${order.product_name}) GAGAL setelah cek ulang: ${reason}.`,
  );
  return { step: "failed", detail: reason, wa };
}

/** Cek ulang semua pesanan lunas yang masih Pending (dipanggil cron harian,
 *  klik admin, dan tiap webhook masuk). */
export async function recheckPendingTopups(): Promise<{
  checked: number;
  results: ExecuteOutcome[];
}> {
  const orders = await listPendingTopups();
  const results: ExecuteOutcome[] = [];
  for (const o of orders) {
    results.push(await recheckTopupOrder(o));
  }
  return { checked: orders.length, results };
}
