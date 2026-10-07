// Daftar metode pembayaran Duitku yang aktif — dipakai picker kanal di modal
// checkout (baris QRIS / Transfer Bank dengan logo resmi gateway). Hasil
// di-cache in-memory 10 menit di src/lib/duitku.ts.
import { NextResponse } from "next/server";
import {
  duitkuConfigured,
  getDuitkuPaymentMethods,
  DUITKU_MIN_AMOUNT,
} from "@/lib/duitku";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!duitkuConfigured()) {
    return NextResponse.json({ ok: false, methods: [] });
  }
  const url = new URL(req.url);
  const amount = Number(url.searchParams.get("amount")) || DUITKU_MIN_AMOUNT;
  try {
    const methods = await getDuitkuPaymentMethods(amount);
    return NextResponse.json({ ok: true, methods });
  } catch (e) {
    console.error("GET /api/duitku/methods error:", e);
    return NextResponse.json({ ok: false, methods: [] });
  }
}
