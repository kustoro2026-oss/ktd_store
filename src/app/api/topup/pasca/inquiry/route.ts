// Cek tagihan pascabayar (Bayar Tagihan): validasi SKU dari katalog pasca
// efektif, kirim inq-pasca ke Digiflazz, lalu SIMPAN pesanan dengan jumlah
// tagihan (payment_status masih pending — belum dibayar). Pembeli melihat
// rincian tagihan lalu lanjut ke POST /api/topup/pasca/order untuk membuat
// sesi pembayaran QRIS.
//
// Body: { sku, customerNo }
// Respons: { ok, orderId, customerName, periode, price, admin, total, detail }

import { NextResponse } from "next/server";
import { getEffectivePascaBySku } from "@/lib/topup-live";
import { digiflazzPasca } from "@/lib/digiflazz";
import { createTopupOrder, newOrderId, newRefId } from "@/lib/db";
import { clientIp, rateLimitHit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Rincian tagihan dari respons inq-pasca (dokumen developer.digiflazz.com):
 *  price = potongan deposit kita, selling_price = yang dibayar klien,
 *  admin = biaya admin total. Semua bentuk angka bisa int atau string. */
function parseBill(raw: unknown): {
  price: number;
  selling: number;
  admin: number;
} {
  const d = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<
    string,
    unknown
  >;
  const num = (v: unknown) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    price: num(d.price),
    selling: num(d.selling_price),
    admin: num(d.admin),
  };
}

function descDetail(raw: unknown): Array<Record<string, unknown>> {
  const d = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<
    string,
    unknown
  >;
  const desc = (d.desc && typeof d.desc === "object" && !Array.isArray(d.desc)
    ? d.desc
    : {}) as Record<string, unknown>;
  return Array.isArray(desc.detail) ? (desc.detail as Array<Record<string, unknown>>) : [];
}

export async function POST(req: Request) {
  // Cek tagihan tidak memotong saldo — batas longgar, cukup cegah flood API.
  if (rateLimitHit(`topup-pasca-inq:${clientIp(req)}`, 10 * 60_000, 20)) {
    return NextResponse.json(
      { ok: false, error: "Terlalu banyak percobaan. Silakan coba beberapa saat lagi." },
      { status: 429 },
    );
  }

  let body: { sku?: unknown; customerNo?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const sku = String(body.sku ?? "").trim();
  // Katalog efektif — SKU pasca yang dinonaktifkan sinkron (mati) ditolak.
  const product = await getEffectivePascaBySku(sku);
  if (!product) {
    return NextResponse.json({ ok: false, error: "sku_tidak_dikenal" }, { status: 400 });
  }
  const customerNo = String(body.customerNo ?? "").trim();
  if (!customerNo || customerNo.length < 3 || customerNo.length > 60) {
    return NextResponse.json(
      { ok: false, error: "isi_nomor_pelanggan", message: "Isi nomor pelanggan yang benar." },
      { status: 400 },
    );
  }

  // ref_id dibuat SEKALI di sini — dipakai ulang untuk pay-pasca (ref terikat
  // tagihan) dan menjadi merchantOrderId Duitku saat lanjut bayar.
  const refId = newRefId();
  const res = await digiflazzPasca({ commands: "inq-pasca", sku, customerNo, refId });
  if (!res.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "layanan_tidak_tersedia",
        message: "Layanan cek tagihan sedang tidak tersedia. Silakan coba beberapa saat lagi.",
      },
      { status: 502 },
    );
  }
  if (res.pending && !res.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "tagihan_diproses",
        message: "Cek tagihan masih diproses Digiflazz. Silakan coba lagi beberapa saat.",
      },
      { status: 202 },
    );
  }
  if (!res.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "tagihan_gagal",
        message: res.message || res.status || "Tagihan tidak ditemukan.",
      },
      { status: 400 },
    );
  }

  const bill = parseBill(res.raw);
  if (bill.selling <= 0 || bill.price <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "tagihan_tidak_terbaca",
        message: "Rincian tagihan tidak terbaca. Silakan coba lagi.",
      },
      { status: 502 },
    );
  }

  const d = (res.raw && typeof res.raw === "object" ? res.raw : {}) as Record<string, unknown>;
  const customerName = String(d.customer_name ?? "").slice(0, 100);
  const periode = String(d.periode ?? "").slice(0, 60);
  const detail = descDetail(res.raw);

  const orderId = newOrderId();
  try {
    await createTopupOrder({
      id: orderId,
      ref_id: refId,
      sku: product.sku,
      product_name: product.name,
      customer_no: customerNo,
      // amount = selling_price (yang dibayar pembeli: tagihan + admin),
      // cost = price (yang dipotong dari deposit kita) — gate saldo memakai ini.
      amount: bill.selling,
      cost: bill.price,
      buyer_name: "",
      buyer_phone: "",
      note: [customerName ? `Pelanggan: ${customerName}` : "", periode ? `Periode: ${periode}` : ""]
        .filter(Boolean)
        .join(" | "),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "gagal_menyimpan_pesanan", detail: String(e) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    orderId,
    refId,
    customerName,
    periode,
    price: bill.price,
    admin: bill.admin,
    total: bill.selling,
    detail,
  });
}
