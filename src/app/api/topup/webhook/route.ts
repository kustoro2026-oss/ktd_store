// Penerima webhook Digiflazz — endpoint publik yang dipanggil SERVER
// Digiflazz (bukan browser) saat status transaksi berubah. URL ini yang
// didaftarkan user di member area Digiflazz (Atur Koneksi → Webhook), atau
// dikirim per transaksi lewat cb_url.
//
// Token: Digiflazz tidak menjanjikan header khusus, jadi token diterima dari
// tiga tempat (prioritas): header x-webhook-token, header Authorization
// Bearer, atau query ?token= (mis. cb_url = .../api/topup/webhook?token=XXX).
// Nilai wajib sama dengan TOPUP_WEBHOOK_TOKEN di env toko.
//
// Balasan SELALU 200 "OK" agar retry Digiflazz berhenti (ref tak dikenal pun
// tetap OK — pola yang sama dengan router callback Duitku).

import { logTopupWebhook } from "@/lib/db";
import {
  processDigiflazzWebhook,
  webhookConfigured,
  webhookRefId,
  webhookTokenCocok,
} from "@/lib/digiflazz-webhook";

export const runtime = "nodejs";

const OK = new Response("OK", { status: 200 });

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
  if (!webhookTokenCocok(header || bearer || query)) {
    return new Response("Bad Token", { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  const outcome = await processDigiflazzWebhook(body, { simulate: false });

  // Jejak audit — payload mentah dipangkas di logTopupWebhook (8000 char).
  try {
    await logTopupWebhook({
      refId: webhookRefId(body),
      payload: JSON.stringify(body),
      action: outcome.detail,
    });
  } catch (e) {
    console.error("[webhook] gagal mencatat log:", e instanceof Error ? e.message : e);
  }

  console.log(`[webhook] ${outcome.detail}`);
  return OK;
}
