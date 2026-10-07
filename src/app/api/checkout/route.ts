// Buat pesanan checkout toko (produk fisik) + sesi pembayaran Duitku.
//
// KEAMANAN: harga dan ongkir TIDAK dipercaya dari klien — subtotal dihitung
// ulang dari katalog (rekomendasiJual), ongkir dihitung ulang via
// rateGroupsForProducts (logika sama dengan /api/shipping/rates), lalu total
// dibandingkan dengan nilai klien; beda → ditolak (total_berubah).
//
// Bila gateway belum dikonfigurasi (atau nominal < minimum Duitku), pesanan
// tetap tersimpan dan klien diarahkan ke jalur fallback WhatsApp (mode "wa").
//
// Body: { productId?, items?[{id,qty}], qty?, weight?, destination, name,
//         phone, address, note, districtLabel, selectedRates[{index,service,
//         serviceType}], clientTotal, pageUrl,
//         paymentChannel?: "qris" | "va" }
// Respons: { ok, mode: "duitku" | "wa", orderId, paymentUrl?, total?,
//            qrString?, vaNumber?, channel?, sandbox?, gatewayError? }

import { NextResponse } from "next/server";
import { getDetailCached } from "@/lib/detail-cache";
import { mapEkspedisiToCourierCodes } from "@/lib/kiriminaja";
import { parsePriceText, rateGroupsForProducts } from "@/lib/shipping-rates";
import {
  createStoreOrder,
  newOrderId,
  newRefId,
  setStoreOrderSession,
  type StoreOrderItem,
} from "@/lib/db";
import { createDuitkuPayment, duitkuConfigured, DUITKU_MIN_AMOUNT } from "@/lib/duitku";
import { SITE_URL } from "@/lib/config";

export const runtime = "nodejs";

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

/** URL balik yang aman dipakai sebagai returnUrl Duitku. */
function safePageUrl(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (s.startsWith("https://") || s.startsWith("http://")) {
    return s.slice(0, 300);
  }
  return SITE_URL;
}

export async function POST(req: Request) {
  let body: {
    productId?: unknown;
    items?: unknown;
    qty?: unknown;
    weight?: unknown;
    destination?: unknown;
    name?: unknown;
    phone?: unknown;
    address?: unknown;
    note?: unknown;
    districtLabel?: unknown;
    selectedRates?: unknown;
    clientTotal?: unknown;
    pageUrl?: unknown;
    paymentChannel?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  // ---------- validasi dasar ----------
  const name = String(body.name ?? "").trim().slice(0, 100);
  const phone = String(body.phone ?? "").trim().slice(0, 20);
  const address = String(body.address ?? "").trim().slice(0, 300);
  const note = String(body.note ?? "").trim().slice(0, 300);
  const districtLabel = String(body.districtLabel ?? "").trim().slice(0, 150);
  const destination = Number(body.destination);
  if (!name || !address) {
    return NextResponse.json(
      { ok: false, error: "Nama penerima dan alamat lengkap wajib diisi." },
      { status: 400 },
    );
  }
  if (!destination || !Number.isFinite(destination)) {
    return NextResponse.json(
      { ok: false, error: "Pilih provinsi, kota, dan kecamatan tujuan." },
      { status: 400 },
    );
  }

  // ---------- item & subtotal (hitung ulang dari katalog) ----------
  const productId = String(body.productId ?? "").trim();
  let entries: { id: string; qty: number }[] = [];
  const qty = Math.min(Math.max(1, Number(body.qty) || 1), 999);
  const weight = Number(body.weight) || 0;

  if (productId) {
    entries = [{ id: productId, qty }];
  } else if (Array.isArray(body.items) && body.items.length > 0) {
    const counts = new Map<string, number>();
    for (const it of body.items.slice(0, 50)) {
      const o = it as { id?: unknown; qty?: unknown };
      const id = String(o?.id ?? "").trim();
      if (!id) continue;
      const n = Math.min(Math.max(1, Number(o?.qty) || 1), 999);
      counts.set(id, (counts.get(id) ?? 0) + n);
    }
    entries = [...counts.entries()].map(([id, q]) => ({ id, qty: q }));
    if (!entries.length) {
      return NextResponse.json({ ok: false, error: "produk_tidak_dikenal" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ ok: false, error: "produk_tidak_dikenal" }, { status: 400 });
  }

  const details = await Promise.all(
    [...new Set(entries.map((e) => e.id))].map(async (id) => ({
      id,
      detail: await getDetailCached(id),
    })),
  );
  const nameOf = new Map(details.map((d) => [d.id, d.detail?.name ?? ""]));
  const priceOf = new Map(
    details.map((d) => [d.id, parsePriceText(d.detail?.rekomendasiJual)]),
  );
  if ([...nameOf.values()].some((n) => !n)) {
    return NextResponse.json({ ok: false, error: "produk_tidak_dikenal" }, { status: 400 });
  }

  const subtotal = entries.reduce((s, e) => s + (priceOf.get(e.id) ?? 0) * e.qty, 0);
  if (subtotal <= 0) {
    return NextResponse.json({ ok: false, error: "harga_tidak_dikenal" }, { status: 400 });
  }

  // ---------- ongkir (hitung ulang — logika sama dengan cek ongkir) ----------
  const single = details[0];
  const courier = productId
    ? single?.detail?.ekspedisiList?.length
      ? mapEkspedisiToCourierCodes(single.detail.ekspedisiList)
      : undefined
    : undefined;
  const groups = await rateGroupsForProducts({
    ids: productId ? [productId] : entries.map((e) => e.id),
    destination,
    itemValue: subtotal,
    courier,
    fallbackWeight: productId ? weight : 0,
    qty: productId ? qty : 1,
  });

  const selectedRates = Array.isArray(body.selectedRates)
    ? (body.selectedRates as { index?: unknown; service?: unknown; serviceType?: unknown }[])
    : [];
  if (!selectedRates.length || selectedRates.length !== groups.length) {
    return NextResponse.json({ ok: false, error: "ongkir_berubah" }, { status: 400 });
  }
  const picked: { serviceName: string; etd: string; cost: number }[] = [];
  for (const sel of selectedRates) {
    const idx = Number(sel.index);
    const g = groups[idx];
    if (!g) return NextResponse.json({ ok: false, error: "ongkir_berubah" }, { status: 400 });
    const r = g.results.find(
      (x) => x.service === String(sel.service) && x.service_type === String(sel.serviceType),
    );
    if (!r) return NextResponse.json({ ok: false, error: "ongkir_berubah" }, { status: 400 });
    picked.push({
      serviceName: r.service_name,
      etd: r.etd ?? "",
      cost: Number(r.cost) || 0,
    });
  }
  const shippingCost = picked.reduce((s, p) => s + p.cost, 0);
  const total = subtotal + shippingCost;

  const clientTotal = Number(body.clientTotal);
  if (Number.isFinite(clientTotal) && clientTotal !== total) {
    return NextResponse.json(
      {
        ok: false,
        error: "total_berubah",
        message: "Total pembayaran berubah — muat ulang halaman lalu coba lagi.",
      },
      { status: 400 },
    );
  }

  // ---------- simpan pesanan ----------
  const orderId = newOrderId();
  const refId = newRefId();
  const items: StoreOrderItem[] = entries.map((e) => ({
    id: e.id,
    name: nameOf.get(e.id) ?? e.id,
    qty: e.qty,
    price: priceOf.get(e.id) ?? 0,
  }));
  const shippingLabel = picked
    .map((p, i) => {
      const tag = groups.length > 1 ? `Paket ${i + 1}: ` : "";
      return `${tag}${p.serviceName}${p.etd ? ` (estimasi ${p.etd} hari)` : ""} ${rupiah(p.cost)}`;
    })
    .join(" | ");

  try {
    await createStoreOrder({
      id: orderId,
      ref_id: refId,
      items,
      buyer_name: name,
      buyer_phone: phone,
      address,
      note,
      district_label: districtLabel,
      shipping_label: shippingLabel,
      subtotal,
      shipping_cost: shippingCost,
      cod_fee: 0,
      total,
      payment_method: "duitku",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "gagal_menyimpan_pesanan", detail: String(e) },
      { status: 500 },
    );
  }

  // ---------- sesi pembayaran Duitku ----------
  if (!duitkuConfigured()) {
    return NextResponse.json({ ok: true, orderId, mode: "wa" });
  }
  if (total < DUITKU_MIN_AMOUNT) {
    return NextResponse.json({
      ok: true,
      orderId,
      mode: "wa",
      gatewayError: `Nominal di bawah minimum pembayaran online (Rp ${DUITKU_MIN_AMOUNT.toLocaleString("id-ID")})`,
    });
  }

  const productSummary =
    items.length === 1
      ? `${items[0].name}${items[0].qty > 1 ? ` (×${items[0].qty})` : ""}`
      : `${items.length} produk KTD Store`;

  // Channel spesifik pilihan pembeli (mis. SP = QRIS ShopeePay, VA = Maybank
  // VA, FT = Indomaret) — kirim apa adanya. Bila ditolak gateway (mis. belum
  // aktif), jatuh ke QRIS (SP) lalu VA tanpa duplikasi kode.
  const channelWanted = String(body.paymentChannel ?? "").trim().toUpperCase();
  const attempts = [
    ...new Set(channelWanted ? [channelWanted, "SP", "VA"] : ["SP", "VA"]),
  ];
  let pay: Awaited<ReturnType<typeof createDuitkuPayment>> | null = null;
  let payChannel = "";
  for (const code of attempts) {
    const attempt = await createDuitkuPayment({
      merchantOrderId: refId,
      productName: `${productSummary} — ${orderId}`,
      amount: total,
      buyerName: name,
      buyerPhone: phone,
      returnUrl: safePageUrl(body.pageUrl),
      callbackUrl: `${SITE_URL}/api/duitku/callback`,
      paymentMethod: code,
    });
    if (attempt.ok) {
      pay = attempt;
      payChannel = code;
      break;
    }
    pay = attempt; // simpan error terakhir untuk gatewayError
  }
  if (pay?.ok && pay.paymentUrl) {
    await setStoreOrderSession(
      orderId,
      pay.reference ?? "",
      pay.paymentUrl,
      pay.vaNumber ?? "",
      pay.qrString ?? "",
    );
    return NextResponse.json({
      ok: true,
      orderId,
      mode: "duitku",
      paymentUrl: pay.paymentUrl,
      qrString: pay.qrString ?? "",
      vaNumber: pay.vaNumber ?? "",
      channel: payChannel,
      total,
      sandbox: process.env.DUITKU_SANDBOX === "true",
    });
  }

  return NextResponse.json({
    ok: true,
    orderId,
    mode: "wa",
    gatewayError: pay?.error ?? "sesi pembayaran online gagal dibuat",
  });
}
