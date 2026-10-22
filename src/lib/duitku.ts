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
import { QRIS_CODES } from "./duitku-channels";

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
 *  SQ = QRIS Nusapay (kanal QRIS aktif sejak Okt 2026), SP = QRIS ShopeePay,
 *  NQ = QRIS Nobu. */
export function duitkuPaymentMethod(): string {
  return (process.env.DUITKU_PAYMENT_METHOD ?? "VA").trim() || "VA";
}

/** Nominal minimum transaksi Duitku (Rp). */
export const DUITKU_MIN_AMOUNT = 10_000;

/** Masa berlaku QRIS (menit). Duitku membatasi QRIS maksimal 60 menit;
 *  nilai ini dipakai untuk expiryPeriod inquiry sekaligus hitungan waktu
 *  yang ditampilkan ke pembeli. Override via env bila perlu. */
const _rawQrisExpiry = Number(process.env.DUITKU_QRIS_EXPIRY_MIN);
export const QRIS_EXPIRY_MINUTES =
  Number.isFinite(_rawQrisExpiry) && _rawQrisExpiry > 0 && _rawQrisExpiry <= 60
    ? Math.round(_rawQrisExpiry)
    : 15;

/** Urutan preferensi kanal QRIS: Nusapay (SQ) utama, lalu ShopeePay (SP) dan
 *  Nobu (NQ) sebagai cadangan bila salah satu bermasalah/dicabut. */
export const QRIS_PRIORITY = ["SQ", "SP", "NQ"];

/** Ambang margin kotor (sellPrice − costPrice) minimal agar nominal layak
 *  lewat kanal VA: fee flat VA dipotong dari settlement dan TIDAK terlihat
 *  di API mana pun (bukti transaksi nyata 13 Okt 2026: fee M2 Mandiri VA =
 *  4.000; rentang estimasi kanal lain 3.500–4.500). Default 4.500 = tidak
 *  pernah rugi; override via env TOPUP_VA_MIN_GROSS. */
const _rawMinGross = Number(process.env.TOPUP_VA_MIN_GROSS);
export const VA_MIN_GROSS =
  Number.isFinite(_rawMinGross) && _rawMinGross > 0 ? _rawMinGross : 4_500;

/** True bila margin kotor produk menutup fee flat VA (aman lewat VA). */
export function vaSafeForGross(sellPrice: number, costPrice: number): boolean {
  return sellPrice - costPrice >= VA_MIN_GROSS;
}

/** Harga jual minimal (dibulatkan ke ratusan) agar margin kotor menutup
 *  VA_MIN_GROSS — dipakai untuk pesan info ke pembeli. Margin standar
 *  generator katalog: game 10%, kategori lain 5%. */
export function vaMinSellForCategory(category: string): number {
  const margin = category === "game" ? 0.1 : 0.05;
  const ratio = margin / (1 + margin);
  return Math.ceil(VA_MIN_GROSS / ratio / 100) * 100;
}

/** HMAC-SHA256 hex huruf kecil — dipakai untuk semua signature Duitku. */
function duitkuSign(parts: (string | number)[]): string {
  return createHmac("sha256", process.env.DUITKU_API_KEY ?? "")
    .update(parts.join(""))
    .digest("hex");
}

// ---------- Daftar metode pembayaran aktif (getpaymentmethod) ----------

/** Metode pembayaran aktif milik merchant — untuk picker kanal di UI. */
export type DuitkuPaymentMethod = {
  /** Kode kanal untuk inquiry (mis. SP = QRIS ShopeePay, VA = Maybank VA). */
  code: string;
  /** Nama tampilan (mis. "SHOPEEPAY QRIS", "BCA VA"). */
  name: string;
  /** URL logo resmi dari CDN Duitku. */
  image: string;
  /** Biaya kanal (string angka). */
  fee: string;
};

/** Waktu WIB (Asia/Jakarta) format yyyy-MM-dd HH:mm:ss sesuai docs Duitku. */
function duitkuDatetime(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const wib = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 7 * 3600 * 1000);
  return (
    `${wib.getFullYear()}-${pad(wib.getMonth() + 1)}-${pad(wib.getDate())} ` +
    `${pad(wib.getHours())}:${pad(wib.getMinutes())}:${pad(wib.getSeconds())}`
  );
}

let methodsCache: { at: number; amount: number; list: DuitkuPaymentMethod[] } | null = null;

/** Daftar metode pembayaran aktif (getpaymentmethod) — di-cache in-memory
 *  10 menit per nominal agar tidak memanggil API di setiap request. */
export async function getDuitkuPaymentMethods(
  amount = DUITKU_MIN_AMOUNT,
): Promise<DuitkuPaymentMethod[]> {
  if (!duitkuConfigured()) return [];
  if (
    methodsCache &&
    methodsCache.amount === amount &&
    Date.now() - methodsCache.at < 10 * 60 * 1000
  ) {
    return methodsCache.list;
  }
  const merchantCode = process.env.DUITKU_MERCHANT_CODE ?? "";
  const datetime = duitkuDatetime();
  const body = {
    merchantcode: merchantCode,
    amount,
    datetime,
    signature: duitkuSign([merchantCode, amount, datetime]),
  };
  try {
    const res = await fetch(
      `${duitkuBaseUrl()}/webapi/api/merchant/paymentmethod/getpaymentmethod`,
      {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const d = (await res.json()) as Record<string, unknown>;
    const list: DuitkuPaymentMethod[] = Array.isArray(d.paymentFee)
      ? (d.paymentFee as Record<string, unknown>[]).map((m) => ({
          code: String(m.paymentMethod ?? ""),
          name: String(m.paymentName ?? m.paymentMethod ?? ""),
          image: String(m.paymentImage ?? ""),
          fee: String(m.totalFee ?? "0"),
        }))
      : [];
    methodsCache = { at: Date.now(), amount, list };
    return list;
  } catch (e) {
    console.error("[duitku] getpaymentmethod gagal:", e);
    return methodsCache?.list ?? [];
  }
}

let qrisCodesCache: { at: number; codes: string[] } | null = null;

/** Kode kanal QRIS yang sedang aktif untuk merchant — dipakai sebagai
 *  fallback inquiry, BUKAN konstanta: gateway mencabut/menambah kanal dari
 *  sisi mereka (Okt 2026: SP & NQ nonaktif, SQ/Nusapay aktif), jadi fallback
 *  hard-code bisa mengarah ke kanal mati dan menggagalkan sesi bayar.
 *  Cache 10 menit terpisah dari cache metode per-nominal. */
export async function activeQrisCodes(): Promise<string[]> {
  if (qrisCodesCache && Date.now() - qrisCodesCache.at < 10 * 60 * 1000) {
    return qrisCodesCache.codes;
  }
  const list = await getDuitkuPaymentMethods();
  const codes = list
    .map((m) => m.code)
    .filter((c) => QRIS_CODES.has(c))
    .sort((a, b) => {
      const ia = QRIS_PRIORITY.indexOf(a);
      const ib = QRIS_PRIORITY.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  if (codes.length) {
    qrisCodesCache = { at: Date.now(), codes };
    return codes;
  }
  // Daftar gagal diambil — coba kanal QRIS terkini; kode yang ditolak gateway
  // otomatis lanjut ke fallback berikutnya.
  return ["SQ", "SP"];
}

/** Sisa masa berlaku pembayaran dari created_at pesanan (UTC). QRIS memakai
 *  QRIS_EXPIRY_MINUTES; kanal lama non-QRIS tetap 1440 menit agar halaman
 *  pesanan lama tidak mendadak tampil kedaluwarsa. */
export function paymentExpiryInfo(
  createdAtUtc: string,
  channel = "",
): { expiresAt: string; expiresIn: number } {
  const minutes = QRIS_CODES.has(channel.toUpperCase())
    ? QRIS_EXPIRY_MINUTES
    : 1440;
  const parsed = Date.parse(`${createdAtUtc.replace(" ", "T")}Z`);
  const base = Number.isFinite(parsed) ? parsed : Date.now();
  const expiresAtMs = base + minutes * 60_000;
  return {
    expiresAt: new Date(expiresAtMs).toISOString(),
    expiresIn: Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000)),
  };
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
  /** String QRIS untuk dirender jadi QR code di sisi kita (tanpa redirect). */
  qrString?: string;
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
  /** Kode metode pembayaran (opsional — default env DUITKU_PAYMENT_METHOD).
   *  Kode QRIS (SQ/SP/NQ) menghasilkan qrString, kode VA menghasilkan
   *  vaNumber. */
  paymentMethod?: string;
  /** Masa berlaku transaksi (menit) — QRIS default QRIS_EXPIRY_MINUTES. */
  expiryMinutes?: number;
}): Promise<DuitkuPaymentResult> {
  if (!duitkuConfigured()) {
    return {
      ok: false,
      error: "Pembayaran online belum dikonfigurasi",
    };
  }
  const merchantCode = process.env.DUITKU_MERCHANT_CODE ?? "";
  // Email wajib untuk inquiry Duitku; pembeli kita tidak menyimpan email,
  // jadi pakai alamat placeholder unik per pesanan (tidak dipakai mengirim).
  const email = `pembeli.${i.merchantOrderId.toLowerCase()}@ktdstore.id`;
  const body: Record<string, unknown> = {
    merchantCode,
    paymentAmount: i.amount,
    paymentMethod: i.paymentMethod ?? duitkuPaymentMethod(),
    merchantOrderId: i.merchantOrderId,
    productDetails: i.productName.slice(0, 255),
    customerVaName: (i.buyerName || "KTD Store").slice(0, 20),
    email,
    phoneNumber: (i.buyerPhone ?? "").slice(0, 50),
    // Total itemDetails harus sama dengan paymentAmount (error 409 bila beda).
    itemDetails: [{ name: i.productName.slice(0, 255), price: i.amount, quantity: 1 }],
    callbackUrl: i.callbackUrl,
    returnUrl: i.returnUrl,
    expiryPeriod:
      i.expiryMinutes ??
      (QRIS_CODES.has((i.paymentMethod ?? duitkuPaymentMethod()).toUpperCase())
        ? QRIS_EXPIRY_MINUTES
        : 1440),
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
      return { ok: false, error: `respons gateway pembayaran tidak terbaca (HTTP ${res.status})` };
    }
    const paymentUrl = String(d.paymentUrl ?? "");
    const qrString = String(d.qrString ?? "");
    const vaNumber = String(d.vaNumber ?? "");
    // Tidak semua kanal mengembalikan paymentUrl: QRIS cukup dengan qrString
    // (dirender jadi QR di overlay) — jangan anggap gagal bila salah satu ada.
    if (!res.ok || d.statusCode !== "00" || !(paymentUrl || qrString || vaNumber)) {
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
      paymentUrl,
      vaNumber,
      qrString,
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
      return { ok: false, error: `respons gateway pembayaran tidak terbaca (HTTP ${res.status})` };
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
