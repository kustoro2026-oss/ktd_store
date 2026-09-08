import { NextResponse } from "next/server";
import { getProvinces } from "@/lib/kiriminaja";

// Endpoint diagnostik: memeriksa konfigurasi & konektivitas KiriminAja dari
// server tempat kode ini berjalan (dev maupun production). Selalu membalas
// HTTP 200 agar halaman error CDN/Cloudflare tidak menutupi pesan error asli.
// Tidak menampilkan nilai rahasia (API key hanya dilaporkan sebagai boolean).

export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  let provinces: { ok: boolean; count?: number; error?: string };
  try {
    const p = await getProvinces();
    provinces = { ok: true, count: p.length };
  } catch (e) {
    provinces = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  return NextResponse.json({
    kiriminaja: {
      baseUrl:
        process.env.KIRIMINAJA_BASE_URL ??
        "(default: https://tdev.kiriminaja.com)",
      apiKeyConfigured: Boolean(process.env.KIRIMINAJA_API_KEY),
      originDistrict: process.env.KIRIMINAJA_ORIGIN_DISTRICT ?? null,
    },
    test: {
      provinces,
      elapsedMs: Date.now() - t0,
    },
  });
}
