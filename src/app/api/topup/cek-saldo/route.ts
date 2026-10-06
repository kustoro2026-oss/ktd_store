// Cek saldo Digiflazz untuk halaman admin /topup/admin.
// Header wajib: x-topup-secret (nilai TOPUP_ADMIN_SECRET).
// Env sama dengan /api/topup/execute.

import { NextResponse } from "next/server";
import { createHash } from "crypto";

export const runtime = "nodejs";

const USERNAME = process.env.DIGIFLAZZ_USERNAME ?? "";
const API_KEY = process.env.DIGIFLAZZ_API_KEY ?? "";
const RELAY_URL = process.env.DIGIFLAZZ_RELAY_URL ?? "";
const RELAY_TOKEN = process.env.DIGIFLAZZ_RELAY_TOKEN ?? "";
const ADMIN_SECRET = process.env.TOPUP_ADMIN_SECRET ?? "";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

export async function GET(req: Request) {
  const secret = req.headers.get("x-topup-secret") ?? "";
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!USERNAME || !API_KEY || !RELAY_URL || !RELAY_TOKEN) {
    return NextResponse.json({ ok: false, error: "config_missing" }, { status: 500 });
  }

  const payload = {
    cmd: "deposit",
    username: USERNAME,
    sign: md5(USERNAME + API_KEY + "depo"),
  };

  try {
    const res = await fetch(`${RELAY_URL}?ep=cek-saldo`, {
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
