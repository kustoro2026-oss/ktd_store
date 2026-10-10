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
  recordExecAttempt,
  type TopUpOrder,
} from "./db";
import { digiflazzTopup, shouldRetryFailure, type TopupResult } from "./digiflazz";
import { formatRupiah } from "./topup";
import { alertLowBalanceIfNeeded, getBalance, recordBalance } from "./topup-balance";
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
  // 1. Cek saldo ≥ harga beli (pembacaan segar — gate saat order dibuat
  //    mungkin sudah beberapa menit lalu).
  const bal = await getBalance(true);
  if (!bal.ok) {
    // Relay/API bermasalah — pertahankan Pending supaya cron mencoba lagi
    // setelah layanan pulih, bukan langsung gagal permanen.
    await finishTopup(order.id, "pending", "", `Cek saldo gagal: ${bal.error}`);
    const wa = await notifyTopupOwner(
      `[Top-up] Pesanan ${order.id} (${order.product_name}) menunggu cek ulang — cek saldo Digiflazz gagal (${bal.error}). Cron akan mencoba lagi.`,
    );
    await notifyTopupBuyer(
      order.buyer_phone,
      [
        `Halo ${order.buyer_name || "Kak"}, pembayaran top up kamu sudah kami terima dan sedang diproses.`,
        `Pesanan: ${order.id}`,
        `Produk: ${order.product_name}`,
        "",
        "Kami kabari lagi setelah top up selesai.",
      ].join("\n"),
    );
    return { step: "pending", detail: `cek saldo gagal, ditunda: ${bal.error}`, wa };
  }
  if (bal.balance < order.cost) {
    // Saldo kurang BUKAN kegagalan permanen — pesanan sudah lunas, jadi
    // pertahankan Pending supaya setelah owner deposit, cron / tick webhook
    // mengeksekusi otomatis (recheckTopupOrder memeriksa saldo dulu).
    await finishTopup(order.id, "pending", "", "Saldo Digiflazz kurang — menunggu deposit");
    const wa = await notifyTopupOwner(
      `[Top-up] Saldo Digiflazz kurang untuk pesanan ${order.id}: tersisa ${formatRupiah(bal.balance)}, butuh ${formatRupiah(order.cost)}. Deposit dulu — sistem akan mencoba otomatis setelah saldo cukup.`,
    );
    await notifyTopupBuyer(
      order.buyer_phone,
      [
        `Halo ${order.buyer_name || "Kak"}, pembayaran top up kamu sudah kami terima dan sedang diproses.`,
        `Pesanan: ${order.id}`,
        `Produk: ${order.product_name}`,
        "",
        "Kami kabari lagi setelah top up selesai.",
      ].join("\n"),
    );
    return {
      step: "pending",
      detail: `saldo ${formatRupiah(bal.balance)} < cost ${formatRupiah(order.cost)} — menunggu deposit`,
      wa,
    };
  }

  // 2. Eksekusi transaksi Digiflazz — Lapis 1 retry: kegagalan transien
  //    (mis. rc 74 "Transaksi Refund") yang refund saldonya terkonfirmasi
  //    dicoba ulang dengan ref BARU, maksimal 3 percobaan. Pending & relay
  //    TIDAK PERNAH dicoba dengan ref baru (risiko transaksi ganda).
  const balBefore = bal.ok ? bal.balance : undefined;
  const MAX_ATTEMPTS = 3;
  let res: TopupResult | null = null;
  let percobaan = 0;
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    const attemptRef = n === 1 ? order.ref_id : `${order.ref_id}-${n}`;
    res = await digiflazzTopup({
      sku: order.sku,
      customerNo: order.customer_no,
      refId: attemptRef,
      testing,
    });
    if (!res.ok || res.success || res.pending) break;
    percobaan = n;
    await recordExecAttempt(order.id, attemptRef);
    const d = shouldRetryFailure(res, balBefore);
    if (n < MAX_ATTEMPTS && d.retry) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    break;
  }
  if (!res) {
    // Secara logika tidak tercapai (loop selalu mengisi res) — jaga tipe.
    await finishTopup(order.id, "pending", "", "loop percobaan tidak menghasilkan respons");
    return { step: "pending", detail: "loop percobaan tidak menghasilkan respons" };
  }
  if (!res.ok) {
    // Relay gagal — transaksi mungkin belum sampai Digiflazz; biarkan status
    // "processing" supaya cron mengecek ulang (kirim ulang ref sama).
    await finishTopup(order.id, "pending", "", `relay: ${res.error ?? "tidak terjangkau"}`);
    const wa = await notifyTopupOwner(
      `[Top-up] Pesanan ${order.id} (${order.product_name}) menunggu cek ulang — relay Digiflazz gagal (${res.error}). Cron akan mencoba lagi.`,
    );
    await notifyTopupBuyer(
      order.buyer_phone,
      [
        `Halo ${order.buyer_name || "Kak"}, pembayaran top up kamu sudah kami terima dan sedang diproses.`,
        `Pesanan: ${order.id}`,
        `Produk: ${order.product_name}`,
        "",
        "Kami kabari lagi setelah top up selesai.",
      ].join("\n"),
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
    // Pantau saldo setelah transaksi — peringatkan owner bila mendekati limit.
    await alertAfterTransaction(res.lastBalance);
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

  // Gagal (rc lain / status Gagal) — jalur final setelah percobaan habis.
  const reason = res.message || res.status || "ditolak Digiflazz";
  const label = percobaan > 1 ? `gagal setelah ${percobaan} percobaan: ${reason}` : reason;
  await finishTopup(order.id, "failed", "", label);
  const wa = await notifyTopupBuyer(
    order.buyer_phone,
    [
      `Halo ${order.buyer_name || "Kak"}, maaf top up kamu belum berhasil${percobaan > 1 ? " setelah beberapa kali percobaan" : ""} (${reason}).`,
      `Pesanan: ${order.id}`,
      `Produk: ${order.product_name}`,
      "",
      `Hubungi CS kami ${cs} untuk cek ulang atau pengembalian dana.`,
    ].join("\n"),
  );
  await notifyTopupOwner(
    `[Top-up] Pesanan ${order.id} (${order.product_name}, ${formatRupiah(order.amount)}) GAGAL${percobaan > 1 ? ` setelah ${percobaan} percobaan` : ""}: ${reason}. Tindak lanjut refund via CS.`,
  );
  return { step: "failed", detail: label, wa };
}

/** Peringatan saldo rendah setelah transaksi sukses — pakai saldo dari
 *  respons transaksi bila ada, fallback cek saldo segar. Gagal baca saldo
 *  tidak mengganggu alur sukses. */
async function alertAfterTransaction(lastBalance?: number): Promise<void> {
  let balance = lastBalance;
  if (balance === undefined) {
    const rem = await getBalance(true);
    if (rem.ok) balance = rem.balance;
  } else {
    // Cache saldo di topup-balance masih menyimpan nilai pra-transaksi —
    // segarkan supaya gate pembayaran pesanan berikutnya membaca saldo
    // terkini (bukan saldo basi hingga TTL 60 detik habis).
    recordBalance(balance);
  }
  if (balance !== undefined) {
    await alertLowBalanceIfNeeded(balance);
  }
}

/** Cek ulang pesanan berstatus Pending dengan mengirim ulang ref_id yang
 *  sama ke Digiflazz (idempoten — mengembalikan status terkini). Saldo dicek
 *  dulu: bila masih kurang / tak terbaca, pertahankan pending tanpa
 *  mengirim transaksi yang pasti gagal. */
export async function recheckTopupOrder(order: TopUpOrder): Promise<ExecuteOutcome> {
  const bal = await getBalance(true);
  if (!bal.ok) {
    return { step: "pending", detail: `cek saldo gagal: ${bal.error}` };
  }
  if (bal.balance < order.cost) {
    return {
      step: "pending",
      detail: `saldo ${formatRupiah(bal.balance)} < cost ${formatRupiah(order.cost)} — menunggu deposit`,
    };
  }
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
    await alertAfterTransaction(res.lastBalance);
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
