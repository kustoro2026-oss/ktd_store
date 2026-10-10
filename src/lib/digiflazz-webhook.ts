// Penerima webhook Digiflazz — status transaksi didorong Digiflazz ke URL
// kita (bukan kita yang memanggil). Payload dibaca toleran (dibungkus field
// "data" ataupun datar) karena format resmi dapat berubah antar versi.
//
// Alur: cocokkan ref_id ke tabel topup_orders → petakan status ke
// success/pending/failed → tulis + notifikasi (mode asli) ATAU laporkan saja
// apa yang AKAN terjadi (mode simulasi — dipakai konsol hub). Status tidak
// pernah diturunkan: pesanan yang sudah success tidak diubah oleh webhook
// pending/gagal yang terlambat. Webhook hanyalah lapisan real-time di atas
// pola sinkron + polling yang sudah ada.

import { createHash, createHmac, timingSafeEqual } from "crypto";
import {
  finishTopup,
  getTopupOrderByRef,
} from "./db";
import { notifyTopupBuyer, notifyTopupOwner } from "./wa";
import { whatsappDisplay } from "./config";

const cs = whatsappDisplay();

// ---------- token ----------

/** Token rahasia yang diisi di env toko (TOPUP_WEBHOOK_TOKEN) — nilai yang
 *  sama didaftarkan user di member area Digiflazz / dikirim sebagai cb_url
 *  dengan query ?token=. Perbandingan timing-safe lewat hash sha256. */
export function webhookConfigured(): boolean {
  return Boolean(process.env.TOPUP_WEBHOOK_TOKEN);
}

export function webhookTokenCocok(given: string): boolean {
  const env = process.env.TOPUP_WEBHOOK_TOKEN ?? "";
  if (!env || !given) return false;
  const ha = createHash("sha256").update(given).digest();
  const hb = createHash("sha256").update(env).digest();
  return timingSafeEqual(ha, hb);
}

/** Verifikasi X-Hub-Signature Digiflazz: HMAC-SHA1 atas body mentah dengan
 *  Secret webhook (TOPUP_WEBHOOK_TOKEN), format header "sha1=<hex>" — sama
 *  dengan contoh resmi dokumentasi developer.digiflazz.com/api/buyer/webhook. */
export function webhookSignatureCocok(rawBody: string, signature: string): boolean {
  const secret = process.env.TOPUP_WEBHOOK_TOKEN ?? "";
  if (!secret || !signature) return false;
  const hex = signature.replace(/^sha1=/i, "").trim();
  if (!/^[0-9a-f]{40}$/i.test(hex)) return false;
  const diharapkan = createHmac("sha1", secret).update(rawBody).digest("hex");
  const ha = createHash("sha256").update(hex.toLowerCase()).digest();
  const hb = createHash("sha256").update(diharapkan).digest();
  return timingSafeEqual(ha, hb);
}

// ---------- parser ----------

type ParsedWebhook = {
  refId: string;
  status: string;
  message: string;
  rc: string;
  sn: string;
};

const teks = (v: unknown): string =>
  typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";

/** ref_id mentah dari payload (untuk kolom log) — "" bila tak terbaca. */
export function webhookRefId(body: unknown): string {
  return parseDigiflazzWebhook(body)?.refId ?? "";
}

/** Baca payload webhook — menerima bentuk { data: { ... } } (pembungkus
 *  standar Digiflazz) maupun datar { ref_id, status, ... }. */
function parseDigiflazzWebhook(body: unknown): ParsedWebhook | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const d =
    b.data && typeof b.data === "object"
      ? (b.data as Record<string, unknown>)
      : b;
  const refId = teks(d.ref_id) || teks(d.refId);
  if (!refId) return null;
  return {
    refId,
    status: teks(d.status),
    message: teks(d.message) || teks(d.note),
    rc: teks(d.rc),
    sn: teks(d.sn),
  };
}

/** Petakan status webhook → status internal. Pola sama dengan klasifikasi
 *  digiflazzTopup. "unknown" = status tidak dikenali (tidak ada perubahan). */
function mapStatus(p: ParsedWebhook): "success" | "pending" | "failed" | "unknown" {
  const gabungan = `${p.status} ${p.message}`;
  if (p.rc === "00" || /sukses|success|berhasil/i.test(gabungan)) return "success";
  if (
    p.rc === "03" ||
    p.rc === "39" ||
    /pending|menunggu|dalam proses|sedang diproses|sedang berlangsung/i.test(gabungan)
  ) {
    return "pending";
  }
  if (/gagal|failed|ditolak|reject|tidak dapat diproses|kadaluarsa|expired/i.test(gabungan)) {
    return "failed";
  }
  return "unknown";
}

// ---------- proses ----------

export type WebhookOutcome = {
  ok: boolean;
  /** True bila ref_id cocok dengan baris topup_orders. */
  matched: boolean;
  orderId?: string;
  /** Status pesanan SEBELUM webhook diproses. */
  orderStatusSekarang?: string;
  /** Status internal hasil pemetaan webhook. */
  mapped?: "success" | "pending" | "failed" | "unknown";
  /** True bila status pesanan ditulis (mode asli; selalu false saat simulasi). */
  ditulis?: boolean;
  detail: string;
};

/** Proses satu payload webhook. simulate=true hanya melaporkan apa yang
 *  akan terjadi tanpa menulis DB / mengirim notifikasi. */
export async function processDigiflazzWebhook(
  body: unknown,
  opts: { simulate: boolean },
): Promise<WebhookOutcome> {
  // Event ping Digiflazz (dikirim saat webhook dikonfigurasi) — tidak berisi
  // transaksi, hanya konfirmasi bahwa URL aktif dan dapat digunakan.
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (
      typeof b.hook_id !== "undefined" ||
      (typeof b.sed !== "undefined" && b.hook && typeof b.hook === "object")
    ) {
      return { ok: true, matched: false, detail: "ping webhook diterima (URL aktif)" };
    }
  }

  const parsed = parseDigiflazzWebhook(body);
  if (!parsed) {
    return { ok: false, matched: false, detail: "payload tidak dikenali — ref_id tidak ditemukan di body" };
  }

  const order = await getTopupOrderByRef(parsed.refId);
  if (!order) {
    return {
      ok: true,
      matched: false,
      detail: `ref_id ${parsed.refId} tidak ada di topup_orders (bukan pesanan kita)`,
    };
  }
  if (order.payment_status !== "paid") {
    return {
      ok: true,
      matched: true,
      orderId: order.id,
      orderStatusSekarang: order.topup_status,
      detail: `pesanan ${order.id} belum lunas (${order.payment_status}) — status top-up tidak diubah`,
    };
  }

  const mapped = mapStatus(parsed);
  if (mapped === "unknown") {
    return {
      ok: true,
      matched: true,
      orderId: order.id,
      orderStatusSekarang: order.topup_status,
      mapped,
      detail: `status webhook tidak dikenali ("${parsed.status} ${parsed.message}") — tidak ada perubahan`,
    };
  }

  const o = order;
  const sekarang = o.topup_status;
  // Jangan menurunkan status: pesanan yang sudah final dibiarkan.
  const skip =
    (sekarang === "success" && mapped !== "success") ||
    (sekarang === mapped && mapped !== "pending") ||
    (sekarang === "failed" && mapped === "pending");

  if (skip) {
    return {
      ok: true,
      matched: true,
      orderId: o.id,
      orderStatusSekarang: sekarang,
      mapped,
      detail: `webhook ${mapped} diabaikan — pesanan sudah ${sekarang}`,
    };
  }

  const detail = `pesanan ${o.id}: ${sekarang} → ${mapped}${parsed.sn ? ` (SN ${parsed.sn})` : ""}`;

  if (opts.simulate) {
    return {
      ok: true,
      matched: true,
      orderId: o.id,
      orderStatusSekarang: sekarang,
      mapped,
      detail: `SIMULASI — akan menulis: ${detail}`,
    };
  }

  if (mapped === "success") {
    await finishTopup(o.id, "success", parsed.sn, "");
    const wa = await notifyTopupBuyer(
      o.buyer_phone,
      [
        `Halo ${o.buyer_name || "Kak"}, kabar baik — top up kamu sudah selesai diproses!`,
        `Pesanan: ${o.id}`,
        `Produk: ${o.product_name}`,
        `Tujuan: ${o.customer_no}`,
        ...(parsed.sn ? [`SN: ${parsed.sn}`] : []),
        "",
        "Terima kasih sudah belanja di KTD Store.",
      ].join("\n"),
    );
    return {
      ok: true,
      matched: true,
      orderId: o.id,
      orderStatusSekarang: sekarang,
      mapped,
      ditulis: true,
      detail: `${detail} (WA: ${wa ? "terkirim" : "tanpa nomor"})`,
    };
  }

  if (mapped === "failed") {
    const reason = parsed.message || parsed.status || "ditolak Digiflazz";
    await finishTopup(o.id, "failed", "", reason);
    await notifyTopupBuyer(
      o.buyer_phone,
      [
        `Halo ${o.buyer_name || "Kak"}, maaf top up kamu belum berhasil (${reason}).`,
        `Pesanan: ${o.id}`,
        `Produk: ${o.product_name}`,
        "",
        `Hubungi CS kami ${cs} untuk cek ulang atau pengembalian dana.`,
      ].join("\n"),
    );
    await notifyTopupOwner(
      `[Top-up] Webhook Digiflazz: pesanan ${o.id} (${o.product_name}) GAGAL: ${reason}. Tindak lanjut refund via CS.`,
    );
    return {
      ok: true,
      matched: true,
      orderId: o.id,
      orderStatusSekarang: sekarang,
      mapped,
      ditulis: true,
      detail: `${detail} (pembeli + owner diberi tahu)`,
    };
  }

  // Pending: pertahankan pesanan berjalan — cron cek ulang tetap jadi cadangan.
  await finishTopup(o.id, "pending", "", parsed.message || "status Pending Digiflazz");
  return {
    ok: true,
    matched: true,
    orderId: o.id,
    orderStatusSekarang: sekarang,
    mapped,
    ditulis: true,
    detail,
  };
}
