// Konsol API Digiflazz — dipanggil KTD Hub (admin.kustoro2026.com) lewat
// proxy dengan header x-topup-secret. Kunci API dan penandatanganan md5
// TIDAK PERNAH keluar dari toko: route ini yang membangun payload Digiflazz
// dan menghitung sign (rumus per endpoint ada di src/lib/digiflazz.ts).
//
// Action yang didukung (dokumen developer.digiflazz.com):
//   price-list    — daftar harga (cmd prepaid|pasca)
//   cek-saldo     — sisa deposit
//   topup         — transaksi prabayar (idempoten terhadap ref_id)
//   inq-pasca     — cek tagihan pascabayar
//   pay-pasca     — bayar tagihan pascabayar (ref_id = inquiry)
//   status-pasca  — status transaksi pascabayar
//   inquiry-pln   — inquiry PLN (endpoint khusus, sign pakai customer_no)
//   deposit       — penarikan tiket deposit (BUKAN top-up saldo)
//   webhook-sim   — simulasi payload webhook Digiflazz (tanpa menulis DB)
//   webhook-log   — log webhook masuk terbaru (audit)
//   health-snapshot — daftar SKU gangguan terkini (pintu pra-bayar, read-only)
//
// Endpoint mutasi (topup/pay-pasca/deposit) diizinkan di sini karena konsol
// hub sudah mewajibkan dialog konfirmasi sebelum mengirim. Guard x-topup-secret
// identik dengan route admin toko lainnya.

import { NextResponse, after } from "next/server";
import {
  buildCekSaldoPayload,
  buildDepositPayload,
  buildInquiryPlnPayload,
  buildPascaPayload,
  buildPriceListPayload,
  digiflazzTopup,
  relayDigiflazz,
  type DgRawResult,
  type PascaCommand,
} from "@/lib/digiflazz";
import { listHealthSnapshot, listTopupWebhookLogs } from "@/lib/db";
import { processDigiflazzWebhook } from "@/lib/digiflazz-webhook";
import { refreshHealthSnapshot } from "@/lib/topup-health";

export const runtime = "nodejs";

const ADMIN_SECRET = process.env.TOPUP_ADMIN_SECRET ?? "";

const ACTIONS = new Set([
  "price-list",
  "cek-saldo",
  "topup",
  "inq-pasca",
  "pay-pasca",
  "status-pasca",
  "inquiry-pln",
  "deposit",
  "webhook-sim",
  "webhook-log",
  "health-snapshot",
]);

const PASCA_COMMANDS: Record<string, PascaCommand> = {
  "inq-pasca": "inq-pasca",
  "pay-pasca": "pay-pasca",
  "status-pasca": "status-pasca",
};

/** Hasil relay sukses → data mentah; gagal → 200 + ok:false (pola
 *  upstreamError) supaya detail tetap sampai ke hub — Cloudflare di depan
 *  toko MENGGANTI body respons 5xx dengan halaman teks polos. 403/404 relay
 *  berarti endpoint belum diizinkan di dg_relay.php — pesannya disertakan
 *  supaya konsol hub tahu akar masalahnya. */
function resp(r: DgRawResult, extra?: Record<string, unknown>) {
  if (!r.ok) {
    const blokir =
      r.status === 403 || r.status === 404
        ? " Relay belum mengizinkan endpoint ini — periksa allowlist dg_relay.php."
        : "";
    const status = process.env.NODE_ENV === "production" ? 200 : 502;
    return NextResponse.json(
      {
        ok: false,
        detail: `${r.error ?? `relay_unreachable (HTTP ${r.status ?? "?"})`}${blokir}`,
        status: r.status,
      },
      { status },
    );
  }
  return NextResponse.json({ ok: true, data: r.data, status: r.status, ...extra });
}

const butuh = (fields: (string | null)[]) => fields.every((f) => f !== null && f !== "");

export async function POST(req: Request) {
  const secret = req.headers.get("x-topup-secret") ?? "";
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const b = (body ?? {}) as { action?: string; payload?: Record<string, unknown> };
  const action = String(b.action ?? "");
  const p = (b.payload ?? {}) as Record<string, unknown>;
  if (!ACTIONS.has(action)) {
    return NextResponse.json(
      { ok: false, error: "action_tidak_dikenal" },
      { status: 400 },
    );
  }

  // Baca field string; wajib → null bila kosong (diputus oleh butuh()).
  const str = (k: string): string | null => {
    const v = p[k];
    const s = typeof v === "string" ? v.trim() : "";
    return s || null;
  };

  switch (action) {
    case "price-list": {
      const cmd = str("cmd") === "pasca" ? "pasca" : "prepaid";
      const r = await relayDigiflazz(
        "price-list",
        buildPriceListPayload({
          cmd,
          code: str("code") ?? undefined,
          category: str("category") ?? undefined,
          brand: str("brand") ?? undefined,
          type: str("type") ?? undefined,
        }),
      );
      // Piggyback: data price-list prepaid yang sama dipakai menyegarkan
      // snapshot kesehatan produk (nol panggilan API tambahan — kuota
      // price-list Digiflazz terbatas, rc=83).
      if (cmd === "prepaid" && r.ok) {
        after(() => {
          refreshHealthSnapshot(r.data)
            .then((h) => {
              if (!h.ok) console.warn("[topup] refresh snapshot kesehatan:", h.detail);
            })
            .catch((e) => console.warn("[topup] refresh snapshot kesehatan gagal:", e));
        });
      }
      return resp(r, { cmd });
    }

    case "cek-saldo":
      return resp(await relayDigiflazz("cek-saldo", buildCekSaldoPayload()));

    case "topup": {
      const sku = str("sku");
      const customerNo = str("customerNo");
      const refId = str("refId");
      if (!butuh([sku, customerNo, refId])) {
        return NextResponse.json(
          {
            ok: false,
            error: "field_kurang",
            detail: "buyer_sku_code, customer_no, dan ref_id wajib diisi.",
          },
          { status: 400 },
        );
      }
      const testing = p.testing === true;
      const maxPriceRaw = p.maxPrice;
      const maxPrice =
        typeof maxPriceRaw === "number" && Number.isFinite(maxPriceRaw) && maxPriceRaw > 0
          ? maxPriceRaw
          : undefined;
      const cbUrl = str("cbUrl");
      const r = await digiflazzTopup({
        sku: sku as string,
        customerNo: customerNo as string,
        refId: refId as string,
        testing,
        maxPrice,
        cbUrl: cbUrl ?? undefined,
      });
      if (!r.ok) {
        // 200 di produksi: Cloudflare menutupi body 5xx dengan halaman teks.
        const status = process.env.NODE_ENV === "production" ? 200 : 502;
        return NextResponse.json(
          { ok: false, detail: r.error ?? "relay tidak menjawab" },
          { status },
        );
      }
      return NextResponse.json({
        ok: true,
        refId: r.refId,
        klasifikasi: { success: r.success, pending: r.pending },
        data: r.raw,
      });
    }

    case "inq-pasca":
    case "pay-pasca":
    case "status-pasca": {
      const sku = str("sku");
      const customerNo = str("customerNo");
      const refId = str("refId");
      if (!butuh([sku, customerNo, refId])) {
        return NextResponse.json(
          {
            ok: false,
            error: "field_kurang",
            detail: "buyer_sku_code, customer_no, dan ref_id wajib diisi.",
          },
          { status: 400 },
        );
      }
      const testing = p.testing === true;
      const commands = PASCA_COMMANDS[action];
      return resp(
        await relayDigiflazz(
          "transaction",
          buildPascaPayload(commands, {
            sku: sku as string,
            customerNo: customerNo as string,
            refId: refId as string,
            testing,
          }),
        ),
        { commands, refId },
      );
    }

    case "inquiry-pln": {
      const customerNo = str("customerNo");
      if (!customerNo) {
        return NextResponse.json(
          { ok: false, error: "field_kurang", detail: "customer_no wajib diisi." },
          { status: 400 },
        );
      }
      return resp(
        await relayDigiflazz(
          "inquiry-pln",
          buildInquiryPlnPayload({ customerNo }),
        ),
      );
    }

    case "deposit": {
      const amount = Number(p.amount);
      const bank = str("bank");
      const ownerName = str("ownerName");
      if (!Number.isFinite(amount) || amount <= 0 || !butuh([bank, ownerName])) {
        return NextResponse.json(
          {
            ok: false,
            error: "field_kurang",
            detail: "amount (angka > 0), bank, dan owner_name wajib diisi.",
          },
          { status: 400 },
        );
      }
      return resp(
        await relayDigiflazz(
          "deposit",
          buildDepositPayload({ amount, bank: bank as string, ownerName: ownerName as string }),
        ),
      );
    }

    // Simulasi payload webhook Digiflazz — TIDAK menulis DB, hanya melaporkan
    // apa yang akan terjadi (cocok? status apa? akan ditulis apa?).
    case "webhook-sim": {
      const refId = str("refId");
      const status = str("status");
      if (!butuh([refId, status])) {
        return NextResponse.json(
          { ok: false, error: "field_kurang", detail: "ref_id dan status wajib diisi." },
          { status: 400 },
        );
      }
      const body = {
        data: {
          ref_id: refId,
          status,
          ...(str("sn") ? { sn: str("sn") } : {}),
          ...(str("message") ? { message: str("message") } : {}),
        },
      };
      const outcome = await processDigiflazzWebhook(body, { simulate: true });
      return NextResponse.json({ ...outcome });
    }

    case "webhook-log": {
      const limitRaw = Number(p.limit);
      const limit =
        Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100
          ? Math.floor(limitRaw)
          : 20;
      const logs = await listTopupWebhookLogs(limit);
      return NextResponse.json({ ok: true, data: logs });
    }

    // Snapshot kesehatan produk (read-only) — verifikasi pintu pra-bayar.
    case "health-snapshot": {
      const rows = await listHealthSnapshot();
      return NextResponse.json({ ok: true, data: rows });
    }
  }

  return NextResponse.json({ ok: false, error: "action_tidak_dikenal" }, { status: 400 });
}
