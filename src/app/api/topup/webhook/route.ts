// Penerima webhook Digiflazz — endpoint publik yang dipanggil SERVER
// Digiflazz (bukan browser) saat status transaksi berubah. URL ini yang
// didaftarkan user di member area Digiflazz (Atur Koneksi → Webhook).
//
// Autentikasi DUA jalur (salah satu cukup):
//   1. Token — header x-webhook-token / Authorization Bearer / query ?token=
//      (mis. cb_url = .../api/topup/webhook?token=XXX).
//   2. Tanda tangan X-Hub-Signature — bila kolom Secret webhook diisi,
//      Digiflazz menandatangani body mentah dengan HMAC-SHA1 (header
//      "sha1=<hex>") dan server memverifikasinya terhadap
//      TOPUP_WEBHOOK_TOKEN.
//
// Balasan SELALU 200 "OK" agar retry Digiflazz berhenti (ref tak dikenal pun
// tetap OK — pola yang sama dengan router callback Duitku).

import { logTopupWebhook } from "@/lib/db";
import {
  processDigiflazzWebhook,
  webhookConfigured,
  webhookRefId,
  webhookSignatureCocok,
  webhookTokenCocok,
} from "@/lib/digiflazz-webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!webhookConfigured()) {
    // 503: 5xx membuat Digiflazz retry — konfigurasi kosong memang harus
    // segera diperbaiki owner; retry yang terus berulang bisa menumpuk.
    return Response.json(
      { error: "webhook belum dikonfigurasi (TOPUP_WEBHOOK_TOKEN kosong di toko)" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const header = req.headers.get("x-webhook-token") ?? "";
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const query = url.searchParams.get("token") ?? "";

  // Baca body MENTAH sekali — dipakai untuk verifikasi X-Hub-Signature
  // (HMAC dihitung atas byte persis yang diterima) lalu diparse JSON.
  let rawText = "";
  try {
    rawText = await req.text();
  } catch {
    rawText = "";
  }
  let body: unknown = null;
  if (rawText) {
    try {
      body = JSON.parse(rawText);
    } catch {
      body = null;
    }
  }

  const signature = req.headers.get("x-hub-signature") ?? "";
  const okToken = webhookTokenCocok(header || bearer || query);
  const okSign = webhookSignatureCocok(rawText, signature);
  if (!okToken && !okSign) {
    return new Response("Bad Token", { status: 401 });
  }

  const outcome = await processDigiflazzWebhook(body, { simulate: false });

  // Jejak audit — payload mentah dipangkas di logTopupWebhook (8000 char).
  try {
    await logTopupWebhook({
      refId: webhookRefId(body),
      payload: rawText || JSON.stringify(body),
      action: outcome.detail,
    });
  } catch (e) {
    console.error("[webhook] gagal mencatat log:", e instanceof Error ? e.message : e);
  }

  console.log(`[webhook] event=${req.headers.get("x-digiflazz-event") ?? "?"} ${outcome.detail}`);
  // Response baru tiap request — body sebuah Response hanya bisa dibaca sekali.
  return new Response("OK", { status: 200 });
}
