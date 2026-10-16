// Buat pesanan top-up: validasi SKU dari katalog (harga dihitung ulang
// server-side — harga dari klien diabaikan), simpan pesanan ke database,
// lalu buat sesi pembayaran Duitku. Bila gateway belum dikonfigurasi (atau
// gagal membuat sesi — termasuk nominal di bawah minimum Rp 10.000),
// pesanan tetap tersimpan dan pembeli diarahkan ke fallback WhatsApp (CS
// memverifikasi transfer manual lalu eksekusi dari /topup/admin).
//
// Body: { sku, id, server?, nickname?, buyerName, buyerPhone, paymentChannel? }
// Respons: { ok, orderId, mode: "duitku" | "wa", paymentUrl?, waLink? }

import { NextResponse } from "next/server";
import { TOPUP_PRODUCTS, formatRupiah, providerForSku } from "@/lib/topup";
import { composeCustomerNo, fieldsForProvider } from "@/lib/topup-fields";
import { createTopupOrder, newOrderId, newRefId, setOrderPaymentSession } from "@/lib/db";
import { createDuitkuPayment, duitkuConfigured, DUITKU_MIN_AMOUNT, vaSafeForGross, vaMinSellForCategory } from "@/lib/duitku";
import { QRIS_CODES } from "@/lib/duitku-channels";
import { gateBalanceForCost } from "@/lib/topup-balance";
import { gateProductHealth } from "@/lib/topup-health";
import { notifyTopupOwner } from "@/lib/wa";
import { clientIp, rateLimitHit } from "@/lib/rate-limit";
import { SITE_URL, whatsappLink } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Batasi pembuatan pesanan per IP — cegah spam pesanan, notifikasi WA
  // owner, dan flood inquiry Duitku dari satu klien.
  if (rateLimitHit(`topup-order:${clientIp(req)}`, 10 * 60_000, 10)) {
    return NextResponse.json(
      { ok: false, error: "Terlalu banyak percobaan. Silakan coba beberapa saat lagi." },
      { status: 429 },
    );
  }

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

  // Notifikasi WA ke owner: ada pesanan baru. DI-AWAIT sinkron — after()
  // terbukti tidak tereksekusi di produksi, sehingga notifikasi sebelumnya
  // tidak pernah terkirim. Kegagalan WA tidak boleh menggagalkan pesanan.
  try {
    const r = await notifyTopupOwner(
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
    );
    console.log(`[topup] ${orderId} WA owner saat dibuat: ${r}`);
  } catch {
    // Notifikasi gagal tidak boleh menggagalkan pesanan.
  }

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
        gatewayError: `Pembayaran online tersedia untuk nominal minimal Rp ${DUITKU_MIN_AMOUNT.toLocaleString("id-ID")} — nominal ini belum dapat dibeli melalui halaman.`,
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
    // Kanal VA untuk top-up dikendalikan env TOPUP_VA_ENABLED, TETAPI nominal
    // kecil tetap dilarang walau VA aktif: fee flat VA (terbukti Rp 4.000 dari
    // settlement transaksi nyata dana10000, 13 Okt 2026) memakan margin 5-10%.
    // VA hanya dicoba bila margin kotor (sell − cost) menutup ambang
    // VA_MIN_GROSS (default 4.500). Nominal di bawah ambang jatuh ke QRIS,
    // lalu ke WhatsApp dengan info pengajuan bila QRIS belum aktif.
    const VA_ENABLED = process.env.TOPUP_VA_ENABLED === "true";
    const VA_SAFE =
      VA_ENABLED && vaSafeForGross(product.sellPrice, product.costPrice);
    const attempts = [
      ...new Set(channelWanted ? [channelWanted, "SP", "VA"] : ["SP", "VA"]),
    ].filter((code) => VA_SAFE || QRIS_CODES.has(code));
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
        payChannel,
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
      gatewayError: VA_SAFE
        ? pay?.error ?? "sesi pembayaran online gagal dibuat"
        : VA_ENABLED
          ? `Untuk sementara, transaksi isi saldo di bawah ${formatRupiah(
              vaMinSellForCategory("pulsa"),
            )} dan top up game di bawah ${formatRupiah(
              vaMinSellForCategory("game"),
            )} belum dapat menggunakan pembayaran online karena aktivasi QRIS masih dalam proses pengajuan. Silakan pilih nominal lain atau hubungi CS kami melalui WhatsApp — CS siap memandu pembayaran hingga selesai.`
          : "Pembayaran online sedang tidak tersedia karena aktivasi QRIS masih dalam proses pengajuan. Silakan hubungi CS kami melalui WhatsApp — CS siap memandu pembayaran hingga selesai.",
    });
  }

  return NextResponse.json({ ok: true, orderId, mode: "wa", waLink });
}
