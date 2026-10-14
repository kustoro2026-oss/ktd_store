// Webhook WhatsApp Cloud API — balasan otomatis pesan masuk.
//
// GET  : verifikasi webhook Meta (hub.mode=subscribe → kembalikan hub.challenge)
// POST : payload pesan masuk → klasifikasi → balas otomatis via Cloud API.
//
// Balasan free-form ke pesan MASUK bebas biaya & tanpa template selama
// window 24 jam sejak pesan terakhir pelanggan. Template (mis. info_promo)
// hanya wajib untuk pesan keluar di luar window tersebut.
//
// Env yang dibutuhkan: WA_TOKEN, WA_PHONE_NUMBER_ID, WA_VERIFY_TOKEN.

const GRAPH_VERSION = "v24.0";
const CATALOG_URL = "https://toko.kustoro2026.com/";

// Endpoint ini hanya cadangan — callback Meta produksi menunjuk ke bot KTD
// Hub (admin.kustoro2026.com/api/wa/webhook). Bila pesan masuk tetap sampai
// di sini, cabang top-up di bawah memberi jawaban yang sama seperti bot Hub.
import { getTopupOrder } from "@/lib/db";
import { normalizePhone, safeEqual, verifyWaSignature } from "@/lib/wa";

/**
 * Pemetaan ID iklan CTWA (Meta Ads) → URL produk yang diiklankan.
 * Isi tabel ini setiap kali iklan CTWA baru dibuat, contoh:
 *   "123456789012345": "https://toko.kustoro2026.com/produk/1039",
 * ID iklan bisa dilihat di Ads Manager (kolom ID iklan) atau dari payload
 * webhook (messages[].context.ad_id).
 */
const AD_PRODUCT_MAP: Record<string, string> = {};

/** Dedupe pengiriman ulang webhook Meta (best-effort, per instance). */
const seenMessageIds = new Set<string>();

const REPLY_ORDER = `Terima kasih, pesanan Anda telah kami terima.
Pesanan akan segera kami proses. Nomor resi pengiriman akan dikirimkan melalui chat ini setelah pesanan dikirim.

Hormat kami,
KTD Store`;

const REPLY_GENERAL = `Halo, terima kasih atas respons Anda terhadap info dari KTD Store.

Untuk memesan, silakan kunjungi katalog kami:
${CATALOG_URL}

Cara pemesanan:
1. Pilih produk, lalu klik tombol Order via WhatsApp.
2. Lengkapi nama dan alamat pengiriman (provinsi, kota, kecamatan) — ongkos kirim akan dihitung otomatis.
3. Kirim pesanan melalui WhatsApp. Kami akan segera mengonfirmasi pesanan Anda.

Anda juga dapat membeli melalui marketplace resmi kami: Blibli, TikTok Shop, dan Lazada.

Hormat kami,
KTD Store`;

function replyForAd(productUrl: string): string {
  return `Halo, terima kasih atas minat Anda terhadap produk KTD Store.

Untuk memesan, silakan kunjungi halaman produk berikut:
${productUrl}

Cara pemesanan:
1. Klik tombol Order via WhatsApp pada halaman produk.
2. Lengkapi nama dan alamat pengiriman (provinsi, kota, kecamatan) — ongkos kirim akan dihitung otomatis.
3. Kirim pesanan melalui WhatsApp. Kami akan segera mengonfirmasi pesanan Anda.

Anda juga dapat membeli melalui marketplace resmi kami: Blibli, TikTok Shop, dan Lazada — tombol tersedia di halaman produk.

Hormat kami,
KTD Store`;
}

/** Deteksi pesan berisi data pesanan (format form situs / alamat lengkap). */
function isOrderMessage(text: string): boolean {
  const t = text.toLowerCase();
  // Format pre-filled dari tombol Order via WhatsApp di situs.
  if (/saya ingin memesan produk|data penerima|nama produk:/.test(t)) return true;
  // Alamat gaya Indonesia: RT/RW + nomor (dengan atau tanpa pemisah).
  if (/\brt[\s.,:/_-]*\d|\brw[\s.,:/_-]*\d/.test(t)) return true;
  // Kata kunci wilayah administratif, termasuk singkatan umum
  // (kec./kab./prov./desa/kodepos) — hindari kata niaga seperti "pesan".
  if (
    /\b(kecamatan|kelurahan|kabupaten|provinsi|kode\s*pos|kodepos|desa|kec|kab|kel|prov)\b/.test(t) ||
    /\b(kec|kab|kel|prov)\./.test(t)
  )
    return true;
  // Kode pos 5 digit + kata "alamat", atau nama + alamat disebut bersama.
  if (/\b\d{5}\b/.test(t) && /\balamat\b/.test(t)) return true;
  if (/\bnama\b/.test(t) && /\balamat\b/.test(t)) return true;
  return false;
}

type WaMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  context?: {
    ad_id?: string;
    referred_product?: { catalog_id?: string; product_retailer_id?: string };
  };
};

type WaValue = {
  metadata?: { phone_number_id?: string };
  messages?: WaMessage[];
};

type WaEntry = { changes?: { field?: string; value?: WaValue }[] };

function pickReply(m: WaMessage): string {
  if (m.text?.body && isOrderMessage(m.text.body)) return REPLY_ORDER;
  const adId = m.context?.ad_id;
  if (adId && AD_PRODUCT_MAP[adId]) return replyForAd(AD_PRODUCT_MAP[adId]);
  return REPLY_GENERAL;
}

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

/** Balasan status pesanan top-up untuk pembeli yang chat duluan (gratis,
 *  window 24 jam). Pembeli tidak dikirimi notifikasi WA proaktif — balasan
 *  ini menggantikannya. */
function topupStatusText(o: {
  id: string;
  product_name: string;
  sku: string;
  amount: number;
  payment_status: string;
  topup_status: string;
  payment_va: string;
  payment_qr: string;
  digiflazz_sn: string;
}): string {
  const produk = o.product_name || o.sku;
  const jumlah = rupiah(o.amount);
  const garis: string[] = [];
  if (o.payment_status === "paid") {
    if (o.topup_status === "success") {
      garis.push(
        `Terima kasih atas konfirmasi Anda. Kabar baik — top up ${produk} pada pesanan ${o.id} sudah berhasil diproses.`,
      );
      if (o.digiflazz_sn) garis.push(`Nomor SN: ${o.digiflazz_sn}`);
      garis.push("", "Terima kasih sudah berbelanja di KTD Store.");
    } else if (o.topup_status === "failed") {
      garis.push(
        `Terima kasih atas konfirmasi Anda. Maaf, top up ${produk} pada pesanan ${o.id} belum berhasil diproses.`,
        "Tim kami sedang menindaklanjuti. Untuk cek ulang atau pengembalian dana, silakan hubungi CS kami.",
      );
    } else {
      garis.push(
        `Terima kasih atas konfirmasi Anda. Pembayaran pesanan ${o.id} (${produk}) sebesar ${jumlah} sudah kami terima dan top up sedang diproses.`,
        "Silakan cek kembali statusnya beberapa saat lagi di halaman pembayaran.",
      );
    }
  } else if (o.payment_status === "expired" || o.payment_status === "failed") {
    garis.push(
      `Terima kasih atas konfirmasi Anda. Pembayaran pesanan ${o.id} (${produk}) gagal atau telah kedaluwarsa.`,
      "Silakan buat pesanan baru bila ingin mencoba lagi.",
    );
  } else if (o.payment_va) {
    garis.push(
      `Terima kasih atas konfirmasi Anda. Pembayaran pesanan ${o.id} (${produk}) sebesar ${jumlah} belum kami terima.`,
      `Silakan transfer tepat sebesar ${jumlah} ke nomor Virtual Account berikut:`,
      o.payment_va,
      "",
      "Pesanan akan terverifikasi otomatis setelah transfer diterima.",
    );
  } else if (o.payment_qr) {
    garis.push(
      `Terima kasih atas konfirmasi Anda. Pembayaran pesanan ${o.id} (${produk}) sebesar ${jumlah} belum kami terima.`,
      "Silakan buka halaman pembayaran untuk memindai kode QRIS:",
      `https://toko.kustoro2026.com/topup/bayar/${o.id}`,
      "",
      "Pesanan akan terverifikasi otomatis setelah pembayaran diterima.",
    );
  } else {
    garis.push(
      `Terima kasih atas konfirmasi Anda. Pesanan ${o.id} (${produk}) sebesar ${jumlah} masih menunggu pembayaran.`,
      "Silakan selesaikan pembayaran di halaman pembayaran, atau hubungi CS kami untuk bantuan.",
    );
  }
  garis.push("", "Hormat kami,", "KTD Store");
  return garis.join("\n");
}

async function sendText(to: string, body: string): Promise<void> {
  const token = process.env.WA_TOKEN;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.error("[wa-webhook] WA_TOKEN / WA_PHONE_NUMBER_ID belum diatur");
    return;
  }
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    console.error(`[wa-webhook] kirim gagal ke ${to}: HTTP ${res.status} ${err}`);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const expected = process.env.WA_VERIFY_TOKEN;
  if (
    mode === "subscribe" &&
    expected &&
    token &&
    challenge &&
    safeEqual(token, expected)
  ) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Gagal verifikasi webhook", { status: 403 });
}

export async function POST(request: Request) {
  // Verifikasi signature Meta WAJIB sebelum payload diproses: HMAC-SHA256
  // atas body mentah dengan WA_APP_SECRET. Tanpa env ini route menolak semua
  // permintaan (fail closed) supaya webhook palsu tidak bisa memicu balasan
  // bot berbayar.
  const appSecret = process.env.WA_APP_SECRET;
  if (!appSecret) {
    return Response.json(
      { error: "WA_APP_SECRET belum diatur — verifikasi webhook tidak aktif" },
      { status: 500 },
    );
  }
  const rawBody = await request.text();
  if (
    !verifyWaSignature(
      rawBody,
      request.headers.get("X-Hub-Signature-256"),
      appSecret,
    )
  ) {
    return Response.json(
      { error: "Signature webhook tidak valid" },
      { status: 401 },
    );
  }

  let payload: { entry?: WaEntry[] };
  try {
    payload = JSON.parse(rawBody) as { entry?: WaEntry[] };
  } catch {
    return Response.json({ error: "payload JSON tidak valid" }, { status: 400 });
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages ?? [];
        for (const m of messages) {
          if (m.type !== "text" || !m.from || !m.text?.body) continue;
          if (!m.id || seenMessageIds.has(m.id)) continue;
          seenMessageIds.add(m.id);
          // Pesan menyebut No. Pesanan top-up (KTD-xxx) → balas status
          // pesanan GRATIS dalam window 24 jam dari pesan masuk ini.
          const tid = m.text.body.match(/\b(KTD-[A-Z0-9]{6,})\b/i)?.[1]?.toUpperCase();
          if (tid) {
            const o = await getTopupOrder(tid);
            const from = normalizePhone(m.from);
            const buyer = normalizePhone(o?.buyer_phone ?? "");
            if (o && from && buyer && from === buyer) {
              await sendText(m.from, topupStatusText(o));
              continue;
            }
          }
          await sendText(m.from, pickReply(m));
        }
      }
    }
  } catch (e) {
    console.error("[wa-webhook] gagal memproses payload:", e);
    return Response.json({ error: "gagal memproses payload" }, { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
