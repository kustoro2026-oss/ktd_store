// Cek status & riwayat pesanan top-up (publik — diakses dari halaman
// /topup/cek-status).
//
// GET /api/topup/cek?order=<ID pesanan>   → status satu pesanan
// GET /api/topup/cek?phone=<nomor HP>     → riwayat pesanan (maks 20)
//
// Nomor tujuan pembeli di-mask sebelum dikirim; data pribadi lain (nama,
// nomor HP pembeli, ref internal) tidak pernah dikirim.

import { NextResponse } from "next/server";
import { getTopupOrder, listTopupOrdersByPhone, type TopUpOrder } from "@/lib/db";

export const runtime = "nodejs";

// ---------- rate limit ringan (in-memory per instance) ----------
// Endpoint ini publik — tanpa pembatasan, siapa pun bisa men-scan nomor HP
// untuk memetakan riwayat transaksi. Batasi 30 request/menit per IP (state
// in-memory; di serverless tiap instance punya counter sendiri — tetap
// mengurangi scan massal dari satu klien hangat).

const g = globalThis as unknown as { __ktdCekLimit?: Map<string, number[]> };
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const map = (g.__ktdCekLimit ??= new Map<string, number[]>());
  const hits = (map.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  map.set(ip, hits);
  // Bersihkan entri usang sesekali agar map tidak tumbuh tanpa batas.
  if (map.size > 500) {
    for (const [k, v] of map) {
      if (v.every((t) => now - t >= WINDOW_MS)) map.delete(k);
    }
  }
  return hits.length > MAX_PER_WINDOW;
}

/** "0812xxxx" → "08••••xx12" — aman untuk ditampilkan ke publik. */
function maskTarget(s: string): string {
  const t = s.trim();
  if (!t) return "-";
  if (t.length <= 4) return "••••";
  return t.slice(0, 2) + "••••" + t.slice(-4);
}

function displayStatus(o: TopUpOrder): {
  key: "menunggu" | "diproses" | "sukses" | "gagal";
  label: string;
} {
  if (o.topup_status === "success") return { key: "sukses", label: "Sukses" };
  if (o.topup_status === "failed") return { key: "gagal", label: "Gagal" };
  if (o.payment_status === "paid") return { key: "diproses", label: "Diproses" };
  if (o.payment_status === "expired" || o.payment_status === "failed") {
    return { key: "gagal", label: "Kedaluwarsa / Gagal" };
  }
  return { key: "menunggu", label: "Menunggu Bayar" };
}

/** Bentuk publik satu pesanan — tanpa data sensitif. */
function publicOrder(o: TopUpOrder) {
  return {
    id: o.id,
    product: o.product_name,
    target: maskTarget(o.customer_no),
    amount: o.amount,
    status: displayStatus(o),
    createdAt: o.created_at,
    canPay: o.payment_status === "pending",
  };
}

export async function GET(req: Request) {
  if (rateLimited(clientIp(req))) {
    return NextResponse.json(
      { ok: false, error: "terlalu_sering" },
      { status: 429 },
    );
  }
  const url = new URL(req.url);
  const orderId = (url.searchParams.get("order") ?? "").trim();
  const phone = (url.searchParams.get("phone") ?? "").trim();

  if (orderId) {
    const order = await getTopupOrder(orderId);
    if (!order) {
      return NextResponse.json({ ok: false, error: "pesanan_tidak_ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, order: publicOrder(order) });
  }

  if (phone) {
    const orders = await listTopupOrdersByPhone(phone, 20);
    return NextResponse.json({ ok: true, orders: orders.map(publicOrder) });
  }

  return NextResponse.json(
    { ok: false, error: "isi order atau phone" },
    { status: 400 },
  );
}
