// Eksekusi transaksi top-up Digiflazz melalui relay hosting (IP statis).
//
// Ditujukan untuk halaman admin /topup/admin (CS memverifikasi pembayaran
// lalu mengeksekusi top-up). Kunci Digiflazz TIDAK PERNAH keluar dari
// server — penandatanganan md5(username + apiKey + ref_id) dilakukan di sini,
// lalu request diteruskan ke relay dengan token.
//
// Env yang dibutuhkan:
//   DIGIFLAZZ_USERNAME, DIGIFLAZZ_API_KEY (production key),
//   DIGIFLAZZ_RELAY_URL (mis. http://charcoal-nesia.com/dg_relay.php),
//   DIGIFLAZZ_RELAY_TOKEN, TOPUP_ADMIN_SECRET.
//
// Body: { sku, customerNo, refId?, testing? }
// refId stabil = idempoten: kirim ulang dengan refId yang sama untuk
// mengecek status transaksi (Pending) tanpa transaksi ganda.

import { NextResponse } from "next/server";
import { createHash } from "crypto";

export const runtime = "nodejs";

const USERNAME = process.env.DIGIFLAZZ_USERNAME ?? "";
const API_KEY = process.env.DIGIFLAZZ_API_KEY ?? "";
const RELAY_URL = process.env.DIGIFLAZZ_RELAY_URL ?? "";
const RELAY_TOKEN = process.env.DIGIFLAZZ_RELAY_TOKEN ?? "";
const ADMIN_SECRET = process.env.TOPUP_ADMIN_SECRET ?? "";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

export async function POST(req: Request) {
  const secret = req.headers.get("x-topup-secret") ?? "";
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!USERNAME || !API_KEY || !RELAY_URL || !RELAY_TOKEN) {
    return NextResponse.json({ ok: false, error: "config_missing" }, { status: 500 });
  }

  let body: { sku?: unknown; customerNo?: unknown; refId?: unknown; testing?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const sku = String(body.sku ?? "").trim();
  const customerNo = String(body.customerNo ?? "").trim();
  const refId = String(body.refId ?? "").trim() || `KTD-${Date.now()}`;
  if (!sku || !customerNo) {
    return NextResponse.json({ ok: false, error: "sku_dan_customer_no_wajib" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    username: USERNAME,
    buyer_sku_code: sku,
    customer_no: customerNo,
    ref_id: refId,
  };
  if (body.testing === true) payload.testing = true;
  payload.sign = md5(USERNAME + API_KEY + refId);

  try {
    const res = await fetch(`${RELAY_URL}?ep=transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Relay-Token": RELAY_TOKEN,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return NextResponse.json({ ok: res.status < 500, status: res.status, data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "relay_unreachable", detail: String(e) },
      { status: 502 },
    );
  }
}
