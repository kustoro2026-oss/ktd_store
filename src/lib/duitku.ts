// Integrasi Duitku Payment API — sumber resmi: https://docs.duitku.com/api/id/
// (dibaca ulang 6 Okt 2026; sejak Apr 2026 signature memakai HMAC-SHA256,
// skema MD5/SHA256 lama sudah obsolete).
//
// Base URL:  sandbox  = https://sandbox.duitku.com
//            produksi = https://passport.duitku.com
// Signature: HMAC-SHA256(stringToSign, apiKey) hex huruf kecil.
//   - inquiry (buat transaksi) : merchantCode + merchantOrderId + paymentAmount
//   - cek transaksi             : merchantCode + merchantOrderId
//   - callback (Duitku → kita)  : merchantCode + amount + merchantOrderId
// Callback datang sebagai POST x-www-form-urlencoded dengan resultCode
// ("00" sukses, "01" gagal). returnUrl di-redirect Duitku dengan query
// ?merchantOrderId=&resultCode=&reference= (resultCode redirect: 00 sukses,
// 01 pending, 02 dibatalkan).
//
// Batasan penting: minimum transaksi Rp 10.000 (error 400 "Minimum Payment
// 10000 IDR") — pesanan di bawah itu otomatis dialihkan ke jalur WhatsApp.

import { createHmac } from "crypto";

export function duitkuBaseUrl(): string {
  return process.env.DUITKU_SANDBOX === "true"
    ? "https://sandbox.duitku.com"
    : "https://passport.duitku.com";
}

export function duitkuConfigured(): boolean {
  return !!(process.env.DUITKU_MERCHANT_CODE && process.env.DUITKU_API_KEY);
}

/** Kode metode pembayaran default (bisa diubah via env DUITKU_PAYMENT_METHOD):
 *  VA = Maybank VA, BC = BCA VA, BR = BRIVA, BT = Permata VA, IR = Indomaret,
 *  NQ = QRIS Nobu, SP = QRIS ShopeePay. */
export function duitkuPaymentMethod(): string {
  return (process.env.DUITKU_PAYMENT_METHOD ?? "VA").trim() || "VA";
}

/** Nominal minimum transaksi Duitku (Rp). */
export const DUITKU_MIN_AMOUNT = 10_000;

/** HMAC-SHA256 hex huruf kecil — dipakai untuk semua signature Duitku. */
function duitkuSign(parts: (string | number)[]): string {
  return createHmac("sha256", process.env.DUITKU_API_KEY ?? "")
    .update(parts.join(""))
    .digest("hex");
}

// ---------- Buat transaksi (inquiry) ----------

export type DuitkuPaymentResult = {
  ok: boolean;
  /** Referensi transaksi dari Duitku — disimpan untuk pelacakan. */
  reference?: string;
  /** URL halaman pembayaran Duitku (arahkan pembeli ke sini). */
  paymentUrl?: string;
  /** Nomor pembayaran / virtual account. */
  vaNumber?: string;
  error?: string;
};

export async function createDuitkuPayment(i: {
  /** merchantOrderId unik — = ref_id pesanan kita (≤50 karakter). */
  merchantOrderId: string;
  productName: string;
  /** Harga jual (Rp) — minimal 10.000. */
  amount: number;
  buyerName?: string;
  buyerPhone?: string;
  /** URL kembali setelah pembayaran (redirect Duitku). */
  returnUrl: string;
  /** URL webhook callback. */
  callbackUrl: string;
}): Promise<DuitkuPaymentResult> {
  if (!duitkuConfigured()) {
    return {
      ok: false,
      error: "Duitku belum dikonfigurasi (DUITKU_MERCHANT_CODE / DUITKU_API_KEY)",
    };
  }
  const merchantCode = process.env.DUITKU_MERCHANT_CODE ?? "";
  // Email wajib untuk inquiry Duitku; pembeli kita tidak menyimpan email,
  // jadi pakai alamat placeholder unik per pesanan (tidak dipakai mengirim).
  const email = `pembeli.${i.merchantOrderId.toLowerCase()}@ktdstore.id`;
  const body: Record<string, unknown> = {
    merchantCode,
    paymentAmount: i.amount,
    paymentMethod: duitkuPaymentMethod(),
    merchantOrderId: i.merchantOrderId,
    productDetails: i.productName.slice(0, 255),
    customerVaName: (i.buyerName || "KTD Store").slice(0, 20),
    email,
    phoneNumber: (i.buyerPhone ?? "").slice(0, 50),
    // Total itemDetails harus sama dengan paymentAmount (error 409 bila beda).
    itemDetails: [{ name: i.productName.slice(0, 255), price: i.amount, quantity: 1 }],
    callbackUrl: i.callbackUrl,
    returnUrl: i.returnUrl,
    // 1440 menit = maksimal masa berlaku Virtual Account (default VA).
    expiryPeriod: 1440,
    signature: duitkuSign([merchantCode, i.merchantOrderId, i.amount]),
  };
  try {
    const res = await fetch(`${duitkuBaseUrl()}/webapi/api/merchant/v2/inquiry`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, error: `respons Duitku tidak terbaca (HTTP ${res.status})` };
    }
    if (!res.ok || d.statusCode !== "00" || !d.paymentUrl) {
      return {
        ok: false,
        error: String(
          d.Message ?? d.statusMessage ?? `HTTP ${res.status} ${text.slice(0, 140)}`,
        ),
      };
    }
    return {
      ok: true,
      reference: String(d.reference ?? ""),
      paymentUrl: String(d.paymentUrl),
      vaNumber: String(d.vaNumber ?? ""),
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------- Cek transaksi (pemulihan bila callback terlewat) ----------

export type DuitkuStatusResult = {
  ok: boolean;
  /** statusCode Duitku: "00" sukses, "01" pending, "02" batal. */
  statusCode?: string;
  statusMessage?: string;
  reference?: string;
  amount?: string;
  error?: string;
};

export async function checkDuitkuTransaction(
  merchantOrderId: string,
): Promise<DuitkuStatusResult> {
  if (!duitkuConfigured()) return { ok: false, error: "config_missing" };
  const merchantCode = process.env.DUITKU_MERCHANT_CODE ?? "";
  const body = {
    merchantCode,
    merchantOrderId,
    signature: duitkuSign([merchantCode, merchantOrderId]),
  };
  try {
    const res = await fetch(`${duitkuBaseUrl()}/webapi/api/merchant/transactionStatus`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, error: `respons Duitku tidak terbaca (HTTP ${res.status})` };
    }
    if (!res.ok || typeof d.statusCode !== "string") {
      return { ok: false, error: String(d.Message ?? `HTTP ${res.status}`) };
    }
    return {
      ok: true,
      statusCode: d.statusCode,
      statusMessage: String(d.statusMessage ?? ""),
      reference: String(d.reference ?? ""),
      amount: String(d.amount ?? ""),
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------- Verifikasi callback (webhook) ----------

export type DuitkuCallback = {
  ok: boolean;
  reason?: string;
  /** merchantOrderId dari Duitku = ref_id pesanan kita. */
  merchantOrderId?: string;
  /** resultCode callback: "00" sukses, "01" gagal. */
  resultCode?: string;
  reference?: string;
  amount?: number;
  paymentCode?: string;
};

/** Verifikasi callback Duitku (POST x-www-form-urlencoded). Signature =
 *  HMAC-SHA256(merchantCode + amount + merchantOrderId, apiKey) hex. */
export function verifyDuitkuCallback(rawBody: string): DuitkuCallback {
  if (!duitkuConfigured()) return { ok: false, reason: "config_missing" };
  const p = new URLSearchParams(rawBody);
  const merchantCode = p.get("merchantCode") ?? "";
  const amount = p.get("amount") ?? "";
  const merchantOrderId = p.get("merchantOrderId") ?? "";
  const signature = (p.get("signature") ?? "").trim().toLowerCase();
  if (!merchantCode || !amount || !merchantOrderId || !signature) {
    return { ok: false, reason: "bad_parameter" };
  }
  if (merchantCode !== process.env.DUITKU_MERCHANT_CODE) {
    return { ok: false, reason: "bad_merchant" };
  }
  const expected = duitkuSign([merchantCode, amount, merchantOrderId]);
  if (signature !== expected) return { ok: false, reason: "invalid_signature" };
  return {
    ok: true,
    merchantOrderId,
    resultCode: p.get("resultCode") ?? "",
    reference: p.get("reference") ?? "",
    amount: Number(amount),
    paymentCode: p.get("paymentCode") ?? "",
  };
}
