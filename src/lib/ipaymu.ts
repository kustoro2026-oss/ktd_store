// Integrasi iPaymu Payment API v2 — sumber resmi:
//   repo docs: ipaymu/docs-ipaymu-api-v2 (content/docs/signature.mdx,
//   content/docs/callback.mdx, content/docs/payment/redirect-payment.mdx)
//   sample resmi: ipaymu/ipaymu-payment-v2-sample-php
//
// DUA skema tanda tangan berbeda — jangan tertukar:
// 1. Request (buat pembayaran / cek transaksi):
//      bodyHash  = sha256(jsonBody) hex huruf kecil
//      toSign    = "POST:VA:bodyHash:APIKEY"
//      signature = HMAC-SHA256(toSign, APIKEY) hex
//    Header: va, timestamp (format YmdHis zona WIB), signature.
// 2. Callback (webhook iPaymu → server kita):
//      secret    = NOMOR VA (bukan API key!)
//      signature = HMAC-SHA256(json kunci terurut dari body yang sudah
//                  dinormalisasi tipenya, dengan "/" di-escape jadi "\/", VA)
//    Header: X-Signature. Balas HTTP 200 agar iPaymu berhenti retry.

import { createHash, createHmac } from "crypto";

const SANDBOX = process.env.IPAYMU_SANDBOX === "true";

export function ipaymuBaseUrl(): string {
  return SANDBOX ? "https://sandbox.ipaymu.com" : "https://my.ipaymu.com";
}

export function ipaymuConfigured(): boolean {
  return !!(process.env.IPAYMU_VA && process.env.IPAYMU_API_KEY);
}

/** Timestamp header iPaymu — format PHP Date('YmdHis') dalam zona WIB
 *  (UTC+7), zona waktu yang dipakai iPaymu. */
export function ipaymuTimestamp(): string {
  const w = new Date(Date.now() + 7 * 3600_000);
  return w.toISOString().slice(0, 19).replace(/[-T:]/g, "");
}

/** Signature untuk REQUEST API iPaymu (skema 1 di atas). */
function signRequest(bodyJson: string, method: string): string {
  const va = process.env.IPAYMU_VA ?? "";
  const apiKey = process.env.IPAYMU_API_KEY ?? "";
  const bodyHash = createHash("sha256").update(bodyJson).digest("hex").toLowerCase();
  const stringToSign = `${method.toUpperCase()}:${va}:${bodyHash}:${apiKey}`;
  return createHmac("sha256", apiKey).update(stringToSign).digest("hex");
}

/** Panggil API iPaymu v2 dengan header signature standar. */
async function callIpaymu(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  if (!ipaymuConfigured()) {
    return { ok: false, error: "iPaymu belum dikonfigurasi (IPAYMU_VA / IPAYMU_API_KEY)" };
  }
  const jsonBody = JSON.stringify(body);
  try {
    const res = await fetch(`${ipaymuBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        va: process.env.IPAYMU_VA ?? "",
        signature: signRequest(jsonBody, "POST"),
        timestamp: ipaymuTimestamp(),
      },
      body: jsonBody,
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------- Buat pembayaran (redirect ke halaman iPaymu) ----------

export type CreatePaymentResult = {
  ok: boolean;
  sessionId?: string;
  paymentUrl?: string;
  error?: string;
};

export async function createIpaymuPayment(i: {
  /** referenceId unik — dipakai mencocokkan callback ke pesanan kita. */
  referenceId: string;
  productName: string;
  /** Harga jual (Rp). */
  amount: number;
  buyerName?: string;
  buyerPhone?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}): Promise<CreatePaymentResult> {
  const body: Record<string, unknown> = {
    product: [i.productName],
    qty: ["1"],
    price: [String(i.amount)],
    description: [i.productName],
    returnUrl: i.returnUrl,
    cancelUrl: i.cancelUrl,
    notifyUrl: i.notifyUrl,
    referenceId: i.referenceId,
    expired: 24,
    buyerName: i.buyerName ?? "",
    buyerPhone: i.buyerPhone ?? "",
  };
  const res = await callIpaymu("/api/v2/payment", body);
  const d = res.data as
    | { Status?: number; Message?: string; Data?: { SessionID?: string; Url?: string } }
    | undefined;
  if (!res.ok || !d) return { ok: false, error: res.error ?? "respons iPaymu tidak terbaca" };
  if (d.Status !== 200 || !d.Data?.SessionID || !d.Data?.Url) {
    return { ok: false, error: d.Message ?? `Status ${d.Status ?? "?"}` };
  }
  return { ok: true, sessionId: d.Data.SessionID, paymentUrl: d.Data.Url };
}

// ---------- Cek transaksi (pemulihan bila callback terlewat) ----------

export type CheckTransactionResult = {
  ok: boolean;
  /** Status iPaymu: 0 pending, 1 sukses, 2 batal, 5 gagal, 6 sukses belum
   *  settle, -2 expired. */
  status?: number;
  statusDesc?: string;
  paid?: boolean;
  error?: string;
};

export async function checkIpaymuTransaction(
  transactionId: string,
): Promise<CheckTransactionResult> {
  const res = await callIpaymu("/api/v2/transaction", { transactionId });
  const d = res.data as
    | { Status?: number; Success?: boolean; Message?: string; Data?: Record<string, unknown> }
    | undefined;
  if (!res.ok || !d?.Data) {
    return { ok: false, error: res.error ?? d?.Message ?? "transaksi tidak ditemukan" };
  }
  const status = Number(d.Data.Status);
  return {
    ok: true,
    status,
    statusDesc: String(d.Data.StatusDesc ?? ""),
    paid: d.Data.PaidStatus === "paid" || status === 1 || status === 6,
  };
}

// ---------- Verifikasi callback (webhook) ----------

export type IpaymuCallback = {
  ok: boolean;
  reason?: string;
  referenceId?: string;
  /** status teks iPaymu: berhasil / pending / expired. */
  status?: string;
  /** 1 sukses, 0 pending, -2 expired. */
  statusCode?: number;
  trxId?: string;
  sid?: string;
  /** Nominal bersih diterima (amount - fee). */
  paidOff?: number;
  total?: number;
  channel?: string;
  paymentNo?: string;
  buyerName?: string;
  buyerPhone?: string;
  paidAt?: string;
  isSandbox?: boolean;
};

/** Urutkan kunci objek A-Z ala PHP ksort (dipakai untuk hash callback). */
function phpKsort(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort((a, b) => a.localeCompare(b))) {
    out[k] = obj[k];
  }
  return out;
}

/** Normalisasi tipe data callback form-urlencoded (semua string dari form):
 *  trx_id/status_code/transaction_status_code/paid_off → int,
 *  is_escrow → boolean, additional_info "[]" → array kosong. */
function normalizeFormFields(raw: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key === "is_escrow") {
      out[key] = val === "1" || val === "true";
    } else if (
      ["trx_id", "status_code", "transaction_status_code", "paid_off"].includes(key)
    ) {
      out[key] = parseInt(val, 10);
    } else if (key === "additional_info") {
      out[key] = val === "[]" ? [] : val;
    } else {
      out[key] = String(val);
    }
  }
  if (!("additional_info" in out)) out.additional_info = [];
  return out;
}

/** Hitung signature callback iPaymu: HMAC-SHA256 atas JSON kunci terurut
 *  (dengan "/" di-escape ala PHP json_encode), secret = nomor VA. */
function callbackSignature(payload: Record<string, unknown>): string {
  const sorted = phpKsort(payload);
  const json = JSON.stringify(sorted).replace(/\//g, "\\/");
  return createHmac("sha256", process.env.IPAYMU_VA ?? "").update(json).digest("hex");
}

/** Verifikasi callback iPaymu dan petakan ke field yang dipakai aplikasi.
 *  `rawBody` = body mentah persis seperti dikirim iPaymu (jangan diparse
 *  dulu — hash bergantung pada representasi persisnya). */
export async function verifyIpaymuCallback(
  rawBody: string,
  contentType: string,
  signatureHeader: string,
): Promise<IpaymuCallback> {
  if (!ipaymuConfigured()) return { ok: false, reason: "config_missing" };

  let payload: Record<string, unknown>;
  if ((contentType ?? "").includes("application/json")) {
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return { ok: false, reason: "bad_json" };
    }
  } else {
    // Default iPaymu: application/x-www-form-urlencoded — semua nilai string.
    const raw: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(rawBody)) raw[k] = v;
    payload = normalizeFormFields(raw);
  }
  delete payload.signature; // bila iPaymu ikut menaruh signature di body

  const received = (signatureHeader ?? "").trim().toLowerCase();
  const expected = callbackSignature(payload);
  if (received !== expected) return { ok: false, reason: "invalid_signature" };

  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const num = (v: unknown) => Number(v ?? 0);
  const status = str(payload.status);
  const statusCode = Number.isNaN(num(payload.status_code))
    ? 0
    : num(payload.status_code);

  return {
    ok: true,
    referenceId: str(payload.reference_id) || str(payload.referenceId),
    status: status || (statusCode === 1 ? "berhasil" : statusCode === -2 ? "expired" : "pending"),
    statusCode,
    trxId: str(payload.trx_id),
    sid: str(payload.sid),
    paidOff: num(payload.paid_off),
    total: num(payload.total),
    channel: str(payload.channel),
    paymentNo: str(payload.payment_no),
    buyerName: str(payload.buyer_name),
    buyerPhone: str(payload.buyer_phone),
    paidAt: str(payload.paid_at),
    isSandbox: str(payload.is_sandbox) === "true" || payload.is_sandbox === true,
  };
}
