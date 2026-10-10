// Buat pesanan top-up: validasi SKU dari katalog (harga dihitung ulang
// server-side — harga dari klien diabaikan), simpan pesanan ke database,
// lalu buat sesi pembayaran Duitku. Bila gateway belum dikonfigurasi (atau
// gagal membuat sesi — termasuk nominal di bawah minimum Rp 10.000),
// pesanan tetap tersimpan dan pembeli diarahkan ke fallback WhatsApp (CS
// memverifikasi transfer manual lalu eksekusi dari /topup/admin).
//
// Body: { sku, id, server?, nickname?, buyerName, buyerPhone, paymentChannel? }
// Respons: { ok, orderId, mode: "duitku" | "wa", paymentUrl?, waLink? }

import { NextResponse, after } from "next/server";
import { TOPUP_PRODUCTS, formatRupiah, providerForSku } from "@/lib/topup";
import { composeCustomerNo, fieldsForProvider } from "@/lib/topup-fields";
import { createTopupOrder, newOrderId, newRefId, setOrderPaymentSession } from "@/lib/db";
import { createDuitkuPayment, duitkuConfigured, DUITKU_MIN_AMOUNT } from "@/lib/duitku";
import { gateBalanceForCost } from "@/lib/topup-balance";
import { gateProductHealth } from "@/lib/topup-health";
import { notifyTopupOwner } from "@/lib/wa";
import { SITE_URL, whatsappLink } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: {
    sku?: unknown;
    id?: unknown;
    server?: unknown;
    nickname?: unknown;
    buyerName?: unknown;
    buyerPhone?: unknown;
    paymentChannel?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const sku = String(body.sku ?? "").trim();
  const product = TOPUP_PRODUCTS.find((p) => p.sku === sku);
  if (!product) {
    return NextResponse.json({ ok: false, error: "sku_tidak_dikenal" }, { status: 400 });
  }

  // Pintu kesehatan produk: SKU yang sedang "Gangguan" di Digiflazz ditolak
  // SEBELUM pesanan / sesi bayar dibuat — pelanggan tidak pernah membayar
  // produk yang sudah diketahui bermasalah. Fail-open pada keadaan ragu
  // (relay down, data basi, dsb.).
  const health = await gateProductHealth(sku);
  if (!health.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "produk_gangguan",
        message: "Produk sedang gangguan. Silakan coba beberapa saat lagi.",
      },
      { status: 503 },
    );
  }

  // Skema input per produk (ala itemku) — customer_no disusun sesuai format
  // Digiflazz (ML = "id zone", Genshin/HSR = "UID|Server", dsb.).
  const provider = providerForSku(sku);
  const schema = provider ? fieldsForProvider(provider.slug) : null;
  const values: Record<string, string> = {
    target: String(body.id ?? "").trim(),
    server: String(body.server ?? "").trim(),
    nickname: String(body.nickname ?? "").trim(),
  };

  if (!values.target) {
    return NextResponse.json(
      { ok: false, error: `isi ${product.customerNoLabel}` },
      { status: 400 },
    );
  }
  // Validasi per skema: field wajib + angka (server juga dibutuhkan untuk
  // produk yang butuh gabungan, mis. ML & Genshin).
  for (const f of schema?.fields ?? []) {
    const v = values[f.key] ?? "";
    if (!v && !f.optional) {
      return NextResponse.json({ ok: false, error: `isi ${f.label}` }, { status: 400 });
    }
    if (v && f.numeric && !/^\d+$/.test(v)) {
      return NextResponse.json(
        { ok: false, error: `${f.label} harus berupa angka` },
        { status: 400 },
      );
    }
  }
  const customerNo = provider
    ? composeCustomerNo(provider.slug, values)
    : values.target;
  const nickname = values.nickname;
  const note = nickname ? `Nickname: ${nickname}` : "";

  const buyerName = String(body.buyerName ?? "").trim().slice(0, 100);
  const buyerPhone = String(body.buyerPhone ?? "").trim().slice(0, 20);

  const orderId = newOrderId();
  const refId = newRefId();

  try {
    await createTopupOrder({
      id: orderId,
      ref_id: refId,
      sku: product.sku,
      product_name: product.name,
      customer_no: customerNo,
      amount: product.sellPrice,
      cost: product.costPrice,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      note,
    });
  } catch (e) {
    // Duplikat ref_id sangat jarang — cukup kirim error ke klien.
    return NextResponse.json(
      { ok: false, error: "gagal_menyimpan_pesanan", detail: String(e) },
      { status: 500 },
    );
  }

  // Notifikasi WA ke owner: ada pesanan baru (fire-and-forget — tidak
  // menunda respons ke pembeli).
  after(() => {
    notifyTopupOwner(
      [
        "[Top-up] Pesanan baru masuk:",
        `No. Pesanan: ${orderId}`,
        `Produk: ${product.name}`,
        `Tujuan: ${customerNo}`,
        ...(nickname ? [`Nickname: ${nickname}`] : []),
        `Total: ${formatRupiah(product.sellPrice)}`,
        ...(buyerName ? [`Nama: ${buyerName}`] : []),
        ...(buyerPhone ? [`No. HP: ${buyerPhone}`] : []),
        "Status: menunggu pembayaran",
      ].join("\n"),
    ).catch(() => {
      // Notifikasi gagal tidak boleh menggagalkan pesanan.
    });
  });

  const waLink = whatsappLink(
    [
      "Halo, saya sudah membuat pesanan top up:",
      "",
      `No. Pesanan: ${orderId}`,
      `Produk: ${product.name}`,
      `Tujuan: ${customerNo}`,
      ...(nickname ? [`Nickname: ${nickname}`] : []),
      `Total: Rp ${new Intl.NumberFormat("id-ID").format(product.sellPrice)}`,
      ...(buyerName ? [`Nama: ${buyerName}`] : []),
      ...(buyerPhone ? [`No. HP: ${buyerPhone}`] : []),
    ].join("\n"),
  );

  if (duitkuConfigured()) {
    if (product.sellPrice < DUITKU_MIN_AMOUNT) {
      // Duitku menolak transaksi di bawah Rp 10.000 — arahkan ke WhatsApp.
      return NextResponse.json({
        ok: true,
        orderId,
        mode: "wa",
        waLink,
        gatewayError: `Nominal di bawah minimum pembayaran online (Rp ${DUITKU_MIN_AMOUNT.toLocaleString("id-ID")})`,
      });
    }
    // Gate saldo: jangan buat sesi bayar bila saldo Digiflazz tidak cukup —
    // mencegah "pembeli bayar tapi tidak dilayani". Fail-open saat saldo
    // tidak terbaca (relay down): eksekusi tetap punya pengaman sendiri.
    const gate = await gateBalanceForCost(product.costPrice);
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: "layanan_sibuk" },
        { status: 503 },
      );
    }
    // Kanal spesifik pilihan pembeli (mis. SP = QRIS ShopeePay, VA = Maybank
    // VA, FT = Indomaret) — kirim apa adanya. Bila ditolak gateway (mis.
    // belum aktif), jatuh ke QRIS (SP) lalu VA tanpa duplikasi kode.
    // merchantOrderId WAJIB = ref_id pesanan — router callback mencocokkan
    // merchantOrderId ke kolom ref_id; akhiran apa pun akan membuat callback
    // tidak pernah cocok dan pesanan tidak pernah lunas.
    const channelWanted = String(body.paymentChannel ?? "")
      .trim()
      .toUpperCase();
    const attempts = [
      ...new Set(channelWanted ? [channelWanted, "SP", "VA"] : ["SP", "VA"]),
    ];
    let pay: Awaited<ReturnType<typeof createDuitkuPayment>> | null = null;
    let payChannel = "";
    for (const code of attempts) {
      const attempt = await createDuitkuPayment({
        merchantOrderId: refId,
        productName: `${product.name} (${orderId})`,
        amount: product.sellPrice,
        buyerName,
        buyerPhone,
        returnUrl: `${SITE_URL}/topup/bayar/${orderId}`,
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
      await setOrderPaymentSession(
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
        sandbox: process.env.DUITKU_SANDBOX === "true",
      });
    }
    // Sesi gagal — pesanan tetap ada; pembeli lanjut via WhatsApp.
    return NextResponse.json({
      ok: true,
      orderId,
      mode: "wa",
      waLink,
      gatewayError: pay?.error ?? "sesi pembayaran online gagal dibuat",
    });
  }

  return NextResponse.json({ ok: true, orderId, mode: "wa", waLink });
}
