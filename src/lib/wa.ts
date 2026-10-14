// Klien WhatsApp Cloud API untuk notifikasi transaksi top-up KTD Store.
// Kredensial dibaca dari env (WA_TOKEN, WA_PHONE_NUMBER_ID) — WABA yang sama
// dengan nomor bot toko 6282173427249.
import crypto from "node:crypto";

const GRAPH_VERSION = "v24.0";

/** Template utility 1 variabel yang dipakai untuk status transaksi —
 *  `order_alert_ktd2` (APPROVED, body {{1}}) sudah ada di WABA KTD Store;
 *  bisa diganti lewat env WA_TOPUP_TEMPLATE bila nanti dibuat template
 *  khusus top-up. Kiriman gagal #132001 = template belum disetujui Meta. */
export const TOPUP_TEMPLATE = process.env.WA_TOPUP_TEMPLATE ?? "order_alert_ktd2";

export function waConfigured(): boolean {
  return !!(process.env.WA_TOKEN && process.env.WA_PHONE_NUMBER_ID);
}

/** Banding dua string dengan waktu konstan — anti timing attack untuk
 *  rahasia webhook (verify token dan signature). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Verifikasi header X-Hub-Signature-256 yang dikirim Meta di SETIAP payload
 *  webhook: HMAC-SHA256 atas body MENTAH dengan WA_APP_SECRET (App Secret
 *  aplikasi Meta, dari App Dashboard). Tanpa verifikasi ini siapa pun yang
 *  tahu URL webhook bisa memalsukan pesan masuk. */
export function verifyWaSignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): boolean {
  if (!header) return false;
  const m = header.trim().match(/^sha256=([0-9a-f]{64})$/i);
  if (!m) return false;
  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  return safeEqual(expected.toLowerCase(), m[1].toLowerCase());
}

/** Normalisasi nomor HP Indonesia → format 62xxxxxxxxxxx. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("62") && digits.length >= 10) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `62${digits.slice(1)}`;
  if (digits.length >= 9) return `62${digits}`;
  return null;
}

/** Awalan + untuk kode negara — dokumen Meta menyarankan selalu menyertakan
 *  tanda plus + kode negara di field `to` agar tidak salah normalisasi. */
function withPlus(to: string): string {
  return to.startsWith("+") ? to : `+${to}`;
}

/** Nomor owner penerima notifikasi internal — default nomor CS toko
 *  085171157938; bisa diganti lewat env OWNER_WA_NUMBER (format 62...). */
export function ownerNumber(): string | null {
  return normalizePhone(process.env.OWNER_WA_NUMBER ?? "6285171157938");
}

/** Kirim pesan teks bebas — hanya sah dalam window 24 jam chat masuk. */
export async function sendWaText(
  to: string,
  body: string,
): Promise<{ ok: boolean; error?: string; waId?: string }> {
  if (!waConfigured()) {
    return { ok: false, error: "WA_TOKEN / WA_PHONE_NUMBER_ID belum diatur" };
  }
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WA_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: withPlus(to),
        type: "text",
        text: { body },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: `HTTP ${res.status} ${err.slice(0, 300)}` };
  }
  const data = (await res.json()) as { messages?: { id?: string }[] };
  return { ok: true, waId: data.messages?.[0]?.id };
}

/** Kirim template utility bervariabel {{1}} (bebas window 24 jam). */
export async function sendWaTemplateParam(
  to: string,
  template: string,
  param: string,
  language = "id",
): Promise<{ ok: boolean; error?: string; waId?: string }> {
  if (!waConfigured()) {
    return { ok: false, error: "WA_TOKEN / WA_PHONE_NUMBER_ID belum diatur" };
  }
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WA_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: withPlus(to),
        type: "template",
        template: {
          name: template,
          language: { code: language },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: param }],
            },
          ],
        },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: `HTTP ${res.status} ${err.slice(0, 200)}` };
  }
  const data = (await res.json()) as { messages?: { id?: string }[] };
  return { ok: true, waId: data.messages?.[0]?.id };
}

/** Notifikasi ke owner (nomor CS toko) — teks dulu (window 24 jam), fallback
 *  template utility. */
export async function notifyTopupOwner(text: string): Promise<string> {
  const owner = ownerNumber();
  if (!owner) return "gagal: nomor owner tidak diatur";
  if (!waConfigured()) return "gagal: WA_TOKEN / WA_PHONE_NUMBER_ID belum diatur";
  const txt = await sendWaText(owner, text);
  if (txt.ok) return "ok";
  const param = text.length > 900 ? `${text.slice(0, 900)}...` : text;
  const tpl = await sendWaTemplateParam(owner, TOPUP_TEMPLATE, param);
  if (tpl.ok) return "ok (template)";
  return `gagal: ${txt.error ?? tpl.error ?? "ditolak Meta"}`;
}
