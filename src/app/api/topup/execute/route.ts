// Eksekusi manual transaksi top-up Digiflazz (fallback admin).
//
// Alur otomatis kini lewat webhook iPaymu → topup-execute.ts; endpoint ini
// tetap dipakai halaman /topup/admin untuk eksekusi manual (mis. pesanan
// fallback WhatsApp yang dibayar transfer manual).
//
// Env yang dibutuhkan: DIGIFLAZZ_USERNAME, DIGIFLAZZ_API_KEY,
// DIGIFLAZZ_RELAY_URL, DIGIFLAZZ_RELAY_TOKEN, TOPUP_ADMIN_SECRET.
//
// Body: { sku, customerNo, refId?, testing? }
// refId stabil = idempoten: kirim ulang dengan refId yang sama untuk
// mengecek status transaksi (Pending) tanpa transaksi ganda.

import { NextResponse } from "next/server";
import { digiflazzConfigured, digiflazzTopup } from "@/lib/digiflazz";

export const runtime = "nodejs";

const ADMIN_SECRET = process.env.TOPUP_ADMIN_SECRET ?? "";

export async function POST(req: Request) {
  const secret = req.headers.get("x-topup-secret") ?? "";
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!digiflazzConfigured()) {
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
    return NextResponse.json(
      { ok: false, error: "sku_dan_customer_no_wajib" },
      { status: 400 },
    );
  }

  const res = await digiflazzTopup({
    sku,
    customerNo,
    refId,
    testing: body.testing === true,
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.error ?? "relay_unreachable" },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ok: true,
    refId: res.refId,
    success: res.success,
    pending: res.pending,
    data: {
      ref_id: res.refId,
      status: res.status,
      rc: res.rc,
      message: res.message,
      sn: res.sn,
      ...(typeof res.raw === "object" && res.raw !== null ? (res.raw as object) : {}),
    },
  });
}
