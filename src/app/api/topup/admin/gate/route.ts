// Gerbang password halaman /topup/admin — divalidasi SERVER-SIDE supaya
// password tidak bisa dibaca dari bundle JS browser. Ini lapisan UI belaka:
// seluruh API admin tetap dijaga TOPUP_ADMIN_SECRET lewat admin-guard.ts,
// jadi membuka halaman tanpa password tidak memberi akses data/eksekusi.
//
// Password halaman: TOPUP_ADMIN_PAGE_PASSWORD (default "12345").
// Banding timing-safe (hash sha256) + rate limit per IP (10 percobaan /
// 10 menit) mengikuti pola admin-guard.ts supaya brute-force tidak gampang.

import { NextResponse } from "next/server";
import { secretMatch } from "@/lib/admin-guard";
import { clientIp, rateLimitHit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const PAGE_PASSWORD = process.env.TOPUP_ADMIN_PAGE_PASSWORD || "12345";

export async function POST(req: Request) {
  if (rateLimitHit(`topup-gate:${clientIp(req)}`, 10 * 60_000, 10)) {
    return NextResponse.json(
      { ok: false, error: "terlalu_sering", detail: "terlalu_sering" },
      { status: 429 },
    );
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    password = "";
  }

  if (!password || !secretMatch(password, PAGE_PASSWORD)) {
    return NextResponse.json(
      { ok: false, error: "password_salah", detail: "password_salah" },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true });
}
