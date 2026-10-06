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
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
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
    return { ok: res.status < 500, data };
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
    return { ok: false, balance: 0, error: r.error ?? "relay_unreachable" };
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
    return { ok: false, refId: o.refId, success: false, pending: false, error: r.error ?? "relay_unreachable" };
  }
  const d = r.data as Record<string, unknown> | undefined;
  const rc = String(d?.rc ?? "");
  const status = String(d?.status ?? "");
  const message = String(d?.message ?? "");
  const sn = String(d?.sn ?? "");
  // rc "00" = sukses, "39" = pending; sebagian produk hanya memberi status
  // teks — cocokkan keduanya.
  const success = rc === "00" || /sukses|success/i.test(status);
  const pending = rc === "39" || /pending|proses|sedang/i.test(`${status} ${message}`);
  return {
    ok: true,
    refId: o.refId,
    success,
    pending,
    status,
    rc,
    message,
    sn,
    raw: r.data,
  };
}
