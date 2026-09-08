// Server-side helper for the KiriminAja Mitra API (developer.kiriminaja.com).
// Used by the /api/shipping/* routes to look up coverage areas and rates.
//
// Auth: Authorization: Bearer {api_key}
// Sandbox:    https://tdev.kiriminaja.com
// Production: https://client.kiriminaja.com

import https from "https";

const BASE_URL = process.env.KIRIMINAJA_BASE_URL ?? "https://tdev.kiriminaja.com";
const API_KEY = process.env.KIRIMINAJA_API_KEY ?? "";

export type KAProvince = {
  id: number | string;
  provinsi_name: string;
};

export type KACity = {
  id: number | string;
  provinsi_id: number | string;
  kabupaten_name: string;
  type: string;
  postal_code: string;
};

export type KADistrict = {
  id: number | string;
  kecamatan_name: string;
  kabupaten_id: number | string;
};

export type KARate = {
  service: string;
  service_name: string;
  service_type: string;
  cost: string;
  etd: string;
  cod: boolean;
  group: string;
  drop: boolean;
  insurance: number | string;
};

export type KARateResult = {
  origin: number;
  destination: number;
  weight: number;
  results: KARate[];
};

type KAResponse<T> = {
  status: boolean;
  method: string;
  text: string;
  datas?: T[];
  data?: T[];
  results?: T[];
  details?: Record<string, unknown>;
};

/** POST to the KiriminAja Mitra API and unwrap its envelope. */
async function kaPost<T>(path: string, body?: unknown): Promise<KAResponse<T>> {
  if (!API_KEY) throw new Error("KIRIMINAJA_API_KEY belum diatur di .env.local");

  const url = new URL(path, BASE_URL);
  const payload = JSON.stringify(body ?? {});

  const json = await new Promise<KAResponse<T>>((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        family: 4, // force IPv4: tdev.kiriminaja.com has a broken IPv6 route
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c: Buffer) => (data += c.toString()));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data) as KAResponse<T>);
          } catch {
            reject(new Error(`KiriminAja menjawab dengan format tak terduga (HTTP ${res.statusCode})`));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("KiriminAja timeout (15 detik)")));
    req.write(payload);
    req.end();
  });

  if (json?.status === false) {
    throw new Error(json?.text ?? "KiriminAja menolak permintaan");
  }
  return json;
}

// ─── Simple in-memory cache (sandbox has rate limits / 429) ────────────────
const cache = new Map<string, { t: number; v: unknown }>();
const TTL = 10 * 60 * 1000; // 10 minutes

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v as T;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

/** List all supported provinces. */
export async function getProvinces(): Promise<KAProvince[]> {
  return cached("provinces", async () => {
    const json = await kaPost<KAProvince>("/api/mitra/province");
    return json.datas ?? [];
  });
}

/** List cities by province ID. */
export async function getCities(provinsiId: number | string): Promise<KACity[]> {
  return cached(`cities:${provinsiId}`, async () => {
    const json = await kaPost<KACity>("/api/mitra/city", { provinsi_id: provinsiId });
    return json.datas ?? [];
  });
}

/** List districts by city ID. */
export async function getDistricts(kabupatenId: number | string): Promise<KADistrict[]> {
  return cached(`districts:${kabupatenId}`, async () => {
    const json = await kaPost<KADistrict>("/api/mitra/kecamatan", { kabupaten_id: kabupatenId });
    return json.datas ?? [];
  });
}

export type GetRatesInput = {
  destination: number | string;
  weight: number;
  itemValue?: number;
  courier?: string[];
};

/**
 * Response saat KiriminAja tidak bisa dihubungi/ditolak (mis. sandbox
 * menolak IP server production dengan "Unauthorized.").
 *
 * Di production pakai status 200 + field `error` supaya:
 *  - Cloudflare TIDAK mengganti body dengan halaman "error code: 502";
 *  - browser tidak memunculkan galat "Failed to load resource" di console;
 *  - frontend tetap menampilkan pesan ramah (membaca field `error`).
 * Di development tetap 502 agar status error asli terlihat saat debugging.
 */
export function upstreamError(message: string): Response {
  const status = process.env.NODE_ENV === "production" ? 200 : 502;
  return Response.json({ error: message }, { status });
}

/**
 * Get express shipping prices for a destination district.
 * `origin` comes from KIRIMINAJA_ORIGIN_DISTRICT (the store's district).
 */
export async function getRates(input: GetRatesInput): Promise<KARateResult> {
  const origin = process.env.KIRIMINAJA_ORIGIN_DISTRICT;
  if (!origin) throw new Error("KIRIMINAJA_ORIGIN_DISTRICT belum diatur di .env.local");

  const payload: Record<string, unknown> = {
    origin: Number(origin),
    destination: Number(input.destination),
    weight: input.weight,
  };
  if (input.itemValue && input.itemValue > 0) {
    payload.item_value = input.itemValue;
    // KiriminAja mewajibkan insurance bila item_value dikirim (angka 1 = aktif).
    payload.insurance = 1;
  }
  if (input.courier && input.courier.length) payload.courier = input.courier;

  const json = await kaPost<KARate>("/api/mitra/v6.1/shipping_price", payload);
  return {
    origin: Number(origin),
    destination: Number(input.destination),
    weight: input.weight,
    results: json.results ?? [],
  };
}
