// Klien Digiflazz Buyer API via relay hosting (IP statis yang terdaftar di
// whitelist Digiflazz). Kunci API TIDAK PERNAH keluar dari server —
// penandatanganan md5 dilakukan di sini, relay hanya meneruskan request
// dengan token X-Relay-Token dan daftar endpoint yang diizinkan.
//
// Endpoint yang dipakai:
//   ?ep=cek-saldo   — payload { cmd, username, sign } → { data: { deposit } }
//   ?ep=transaction — payload { username, buyer_sku_code, customer_no,
//                     ref_id, sign, testing? } → { data: { ref_id, status,
//                     message, sn, rc, ... } }
// ref_id stabil = idempoten: kirim ulang dengan ref_id yang sama untuk
// mengecek status transaksi (Pending) tanpa transaksi ganda.

import { createHash } from "crypto";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

function username(): string {
  return process.env.DIGIFLAZZ_USERNAME ?? "";
}

function apiKey(): string {
  return process.env.DIGIFLAZZ_API_KEY ?? "";
}

function relayUrl(): string {
  return process.env.DIGIFLAZZ_RELAY_URL ?? "";
}

function relayToken(): string {
  return process.env.DIGIFLAZZ_RELAY_TOKEN ?? "";
}

export function digiflazzConfigured(): boolean {
  return !!(username() && apiKey() && relayUrl() && relayToken());
}

async function relay(
  ep: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; data?: unknown; error?: string; status?: number }> {
  try {
    const res = await fetch(`${relayUrl()}?ep=${ep}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Relay-Token": relayToken(),
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
    const data = (parsed as { data?: unknown }).data;
    // Hanya 2xx yang dianggap berhasil — 4xx (token relay salah, endpoint
    // diblokir) berarti request tidak pernah sampai Digiflazz dan harus
    // diperlakukan retryable (pending), bukan kegagalan transaksi permanen.
    return { ok: res.ok, data, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ==== Builder payload konsol API (dipakai /api/topup/digiflazz) ====
//
// Rumus sign berbeda per endpoint (dokumen developer.digiflazz.com):
//   price-list      : md5(username + apiKey + "pricelist")
//   cek-saldo       : md5(username + apiKey + "depo")
//   transaction     : md5(username + apiKey + ref_id)
//   inquiry-pln     : md5(username + apiKey + customer_no)
//   deposit         : md5(username + apiKey + "deposit")

export type DgRawResult = {
  ok: boolean;
  /** Respons Digiflazz mentah (variabel data) bila relay membalas 2xx. */
  data?: unknown;
  error?: string;
  status?: number;
};

/** Teruskan payload ke relay tanpa interpretasi — respons data mentah
 *  diteruskan apa adanya supaya konsol bisa menampilkan JSON penuh. */
export async function relayDigiflazz(
  ep: string,
  payload: Record<string, unknown>,
): Promise<DgRawResult> {
  if (!digiflazzConfigured()) {
    return { ok: false, error: "config_missing" };
  }
  return relay(ep, payload);
}

export function buildCekSaldoPayload(): Record<string, unknown> {
  return {
    cmd: "deposit",
    username: username(),
    sign: md5(username() + apiKey() + "depo"),
  };
}

export function buildPriceListPayload(o: {
  cmd: "prepaid" | "pasca";
  code?: string;
  category?: string;
  brand?: string;
  type?: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = { cmd: o.cmd, username: username() };
  if (o.code) payload.code = o.code;
  if (o.category) payload.category = o.category;
  if (o.brand) payload.brand = o.brand;
  if (o.type) payload.type = o.type;
  payload.sign = md5(username() + apiKey() + "pricelist");
  return payload;
}

export type PascaCommand = "inq-pasca" | "pay-pasca" | "status-pasca";

/** Transaksi pascabayar — satu endpoint /v1/transaction dengan perintah
 *  commands. pay-pasca WAJIB memakai ref_id yang sama dengan inquiry-nya. */
export function buildPascaPayload(
  commands: PascaCommand,
  o: { sku: string; customerNo: string; refId: string; testing?: boolean },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    commands,
    username: username(),
    buyer_sku_code: o.sku,
    customer_no: o.customerNo,
    ref_id: o.refId,
  };
  if (o.testing === true) payload.testing = true;
  payload.sign = md5(username() + apiKey() + o.refId);
  return payload;
}

export function buildInquiryPlnPayload(o: {
  customerNo: string;
}): Record<string, unknown> {
  return {
    username: username(),
    customer_no: o.customerNo,
    sign: md5(username() + apiKey() + o.customerNo),
  };
}

export function buildDepositPayload(o: {
  amount: number;
  bank: string;
  ownerName: string;
}): Record<string, unknown> {
  // Dokumen menulis parameter "bank" di tabel namun contoh JSON memakai
  // "Bank" — kirim keduanya supaya cocok dengan versi server mana pun.
  return {
    username: username(),
    amount: o.amount,
    bank: o.bank,
    Bank: o.bank,
    owner_name: o.ownerName,
    sign: md5(username() + apiKey() + "deposit"),
  };
}

export type BalanceResult = {
  ok: boolean;
  balance: number;
  error?: string;
};

/** Cek saldo deposit Digiflazz. */
export async function checkDigiflazzBalance(): Promise<BalanceResult> {
  if (!digiflazzConfigured()) {
    return { ok: false, balance: 0, error: "config_missing" };
  }
  const r = await relay("cek-saldo", buildCekSaldoPayload());
  if (!r.ok) {
    return {
      ok: false,
      balance: 0,
      error: r.error ?? `relay_unreachable (HTTP ${r.status ?? "?"})`,
    };
  }
  const d = r.data as { deposit?: string | number; message?: string } | undefined;
  if (!d || typeof d.deposit === "undefined") {
    return { ok: false, balance: 0, error: d?.message ?? "saldo tidak terbaca" };
  }
  return { ok: true, balance: Number(d.deposit ?? 0) };
}

export type TopupResult = {
  /** False = relay gagal/konfigurasi kurang — belum tentu transaksi gagal. */
  ok: boolean;
  refId: string;
  success: boolean;
  pending: boolean;
  status?: string;
  rc?: string;
  message?: string;
  sn?: string;
  /** Saldo sisa dari respons transaksi (buyer_last_saldo), bila ada. */
  lastBalance?: number;
  raw?: unknown;
  error?: string;
};

/** Kirim (atau cek ulang) transaksi top-up Digiflazz. Kirim ulang dengan
 *  ref_id yang sama bersifat idempoten dan mengembalikan status terkini. */
export async function digiflazzTopup(o: {
  sku: string;
  customerNo: string;
  refId: string;
  testing?: boolean;
  /** Batas harga maksimal (max_price Digiflazz), bila ingin dikunci. */
  maxPrice?: number;
  /** URL callback per transaksi (cb_url) — alternatif pendaftaran webhook
   *  global di member area. Digiflazz akan POST hasil transaksi ke URL ini. */
  cbUrl?: string;
}): Promise<TopupResult> {
  if (!digiflazzConfigured()) {
    return { ok: false, refId: o.refId, success: false, pending: false, error: "config_missing" };
  }
  const payload: Record<string, unknown> = {
    username: username(),
    buyer_sku_code: o.sku,
    customer_no: o.customerNo,
    ref_id: o.refId,
  };
  if (o.testing === true) payload.testing = true;
  if (typeof o.maxPrice === "number" && o.maxPrice > 0) payload.max_price = o.maxPrice;
  if (o.cbUrl) payload.cb_url = o.cbUrl;
  payload.sign = md5(username() + apiKey() + o.refId);

  const r = await relay("transaction", payload);
  if (!r.ok) {
    return {
      ok: false,
      refId: o.refId,
      success: false,
      pending: false,
      error: r.error ?? `relay_unreachable (HTTP ${r.status ?? "?"})`,
    };
  }
  const d = r.data as Record<string, unknown> | undefined;
  // Data kosong = relay membalas tanpa hasil Digiflazz (error HTML / body
  // tidak berbentuk) — perlakukan sebagai kegagalan relay retryable, BUKAN
  // transaksi gagal. Tanpa guard ini respons kosong turun ke klasifikasi
  // rc "" dan pesanan di-finishTopup("failed") padahal saldo tidak terpotong.
  if (!d) {
    return {
      ok: false,
      refId: o.refId,
      success: false,
      pending: false,
      error: "respons relay tidak valid (data kosong)",
    };
  }
  const rc = String(d?.rc ?? "");
  const status = String(d?.status ?? "");
  const message = String(d?.message ?? "");
  const sn = String(d?.sn ?? "");
  const rawBal = d?.buyer_last_saldo;
  const lastBalance =
    typeof rawBal === "number"
      ? rawBal
      : typeof rawBal === "string" && rawBal !== ""
        ? Number(rawBal)
        : undefined;
  // rc "00" = sukses, "03"/"39" = pending; sebagian produk hanya memberi
  // status teks — cocokkan keduanya. HATI-HATI: pola regex lama menyamakan
  // "sedang gangguan" (rc 40/41) dan "tidak dapat diproses" sebagai pending,
  // sehingga pesanan gangguan menggantung selamanya tanpa jalur refund.
  const success = rc === "00" || /sukses|success/i.test(status);
  const pending =
    rc === "03" ||
    rc === "39" ||
    /pending|menunggu|dalam proses|sedang diproses|sedang berlangsung/i.test(
      `${status} ${message}`,
    );
  return {
    ok: true,
    refId: o.refId,
    success,
    pending,
    status,
    rc,
    message,
    sn,
    lastBalance,
    raw: r.data,
  };
}

export type RetryDecision = {
  retry: boolean;
  reason: string;
};

/** Kegagalan transien yang layak dicoba ulang dengan ref BARU (Lapis 1
 *  retry). Syarat mutlak: kegagalan FINAL (bukan sukses/pending — transaksi
 *  yang masih menggantung TIDAK PERNAH dicoba dengan ref baru karena bisa
 *  berakhir dobel) DAN refund saldo terkonfirmasi (rc 74 dijamin refund
 *  oleh dokumen Digiflazz; kode lain butuh bukti buyer_last_saldo sudah
 *  kembali ke nilai sebelum percobaan).
 *
 *  Fungsi murni — aman diuji tanpa jaringan. */
export function shouldRetryFailure(
  res: Pick<TopupResult, "success" | "pending" | "rc" | "status" | "message" | "lastBalance">,
  balanceBefore: number | undefined,
): RetryDecision {
  if (res.success || res.pending) {
    return { retry: false, reason: "bukan kegagalan final (sukses/pending)" };
  }
  const gabungan = `${res.status ?? ""} ${res.message ?? ""}`;
  const transien =
    res.rc === "74" ||
    /transaksi refund|sedang gangguan|produk sedang gangguan|produk sedang tidak stabil|timeout|sedang cut off|transaksi tidak ditemukan/i.test(
      gabungan,
    );
  if (!transien) {
    return {
      retry: false,
      reason: `rc ${res.rc || "?"} bukan kegagalan transien`,
    };
  }
  const refundOk =
    res.rc === "74" ||
    (balanceBefore !== undefined &&
      res.lastBalance !== undefined &&
      res.lastBalance >= balanceBefore);
  if (!refundOk) {
    return {
      retry: false,
      reason: "refund belum terkonfirmasi — jangan mulai transaksi baru",
    };
  }
  return { retry: true, reason: "kegagalan transien + refund terkonfirmasi" };
}
