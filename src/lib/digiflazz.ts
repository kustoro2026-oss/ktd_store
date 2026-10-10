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
  const r = await relay("cek-saldo", {
    cmd: "deposit",
    username: username(),
    sign: md5(username() + apiKey() + "depo"),
  });
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
