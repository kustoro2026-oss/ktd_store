// Server-side helper for the KiriminAja Mitra API (developer.kiriminaja.com).
// Used by the /api/shipping/* routes to look up coverage areas and rates.
//
// Auth: Authorization: Bearer {api_key}
// Sandbox:    https://tdev.kiriminaja.com
// Production: https://client.kiriminaja.com
//
// IP Whitelist Bypass:
// KiriminAja mewajibkan IP statis untuk API key. Karena Vercel memiliki IP
// egress dinamis, kita bisa menggunakan Cloudflare Worker sebagai proxy.
// Set KIRIMINAJA_PROXY_URL ke URL Worker (contoh: https://ka-proxy.namamu.workers.dev)
// Worker akan meneruskan request dengan X-Forwarded-For yang sesuai.
// Jika proxy tidak diset, fallback ke panggilan langsung dengan XFF dari env.

import https from "https";

const BASE_URL = process.env.KIRIMINAJA_BASE_URL ?? "https://tdev.kiriminaja.com";
const API_KEY = process.env.KIRIMINAJA_API_KEY ?? "";
// Opsional: Cloudflare Worker proxy URL untuk bypass IP whitelist.
// Jika diset, semua panggilan API akan melalui proxy ini.
const PROXY_URL = process.env.KIRIMINAJA_PROXY_URL ?? "";
// Gateway KiriminAja memakai nilai X-Forwarded-For sebagai "IP pemanggil"
// untuk whitelist key (bukan IP socket asli). Karena IP egress Vercel dinamis,
// kita kirim IP tetap yang terdaftar di key lewat env ini.
// Catatan: XFF hanya dipakai jika TIDAK menggunakan proxy (proxy yang handle XFF).
const XFF_IP = process.env.KIRIMINAJA_XFF_IP ?? "";

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

// ─── Mapping nama ekspedisi produk → kode kurir KiriminAja ──────────────
//
// Produk anekadropship punya field "Ekspedisi" yang berisi nama kurir dalam
// berbagai format (contoh: "JNE", "J&T", "Ninja Van"). KiriminAja API
// memakai kode pendek: "jne", "jnt", "ninja", dll.
//
// Map ini menjembatani kedua format. Key adalah nama yang sudah
// dinormalisasi (lowercase, non‑alphanumeric dihapus), value adalah kode KA.

export const COURIER_NAME_TO_KA_CODE: Record<string, string> = {
  // JNE — semua varian umum anekadropship
  jne: "jne",
  jneexpress: "jne",
  jnereg: "jne",
  jnectc: "jne",
  jnecitytocity: "jne",
  jalurnugrahaekakurir: "jne",
  jneoke: "jne",
  jneyes: "jne",
  // J&T
  jt: "jnt",
  jnt: "jnt",
  jtexpress: "jnt",
  jntexpress: "jnt",
  jtez: "jnt",
  jntregular: "jnt",
  // Sicepat
  sicepat: "sicepat",
  sicepatekspres: "sicepat",
  sicepatreg: "sicepat",
  sicepatbest: "sicepat",
  sicepatcargo: "sicepat",
  // TIKI
  tiki: "tiki",
  tikireguler: "tiki",
  tikieconomy: "tiki",
  tikions: "tiki",
  titipankilat: "tiki",
  citravantitipankilat: "tiki",
  // SPX / Shopee Express
  spx: "spx",
  shopeexpress: "spx",
  shopexspress: "spx",
  shopeexspress: "spx",
  // AnterAja
  anteraja: "anteraja",
  anterajasameday: "anteraja",
  anterajaregular: "anteraja",
  // Lion Parcel
  lion: "lion",
  lionparcel: "lion",
  lionexpress: "lion",
  regpack: "lion",
  jagopack: "lion",
  bosspack: "lion",
  bigpack: "lion",
  // SAP
  sap: "sap",
  sapexpress: "sap",
  sapsatria: "sap",
  // J&T Cargo
  jtcargo: "jtcargo",
  jntcargo: "jtcargo",
  jtcargoreguler: "jtcargo",
  // NCS
  ncs: "ncs",
  ncsregular: "ncs",
  // ID Express
  idx: "idx",
  idexpress: "idx",
  idekspres: "idx",
  idstandard: "idx",
  // Ninja
  ninja: "ninja",
  ninjavan: "ninja",
  ninjaxpress: "ninja",
  ninjastandard: "ninja",
  // Pos Indonesia
  pos: "pos",
  posindonesia: "pos",
  ptposindonesia: "pos",
  poskilat: "pos",
  // Wahana
  wahana: "wahana",
  wahanareguler: "wahana",
  // JET Express
  jet: "jet",
  jetexpress: "jet",
  // Indah Logistik
  indah: "indah",
  indahlogistik: "indah",
  indahcargo: "indah",
  // PCP
  pcp: "pcp",
  pcpexpress: "pcp",
  // Pandu
  pandu: "pandu",
  pandulogistik: "pandu",
  // REX
  rex: "rex",
  rexexpress: "rex",
};

/**
 * Normalisasi string: lowercase + hapus semua karakter non‑alphanumeric.
 * Cocok untuk mencocokkan nama ekspedisi secara longgar.
 */
export function normalizeCourierName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Konversi daftar nama ekspedisi dari produk (contoh: ["JNE", "J&T", "Ninja Van"])
 * menjadi kode kurir KiriminAja (contoh: ["jne", "jnt", "ninja"]).
 * Nama yang tidak dikenali akan dikembalikan apa adanya (sudah dinormalisasi).
 */
export function mapEkspedisiToCourierCodes(ekspedisi: string[]): string[] {
  const codes = new Set<string>();
  for (const e of ekspedisi) {
    const norm = normalizeCourierName(e);
    const code = COURIER_NAME_TO_KA_CODE[norm] ?? norm;
    codes.add(code);
  }
  return [...codes];
}

/** Semua kode kurir KiriminAja yang dikenal — untuk fuzzy matching fallback. */
const ALL_KA_CODES = [...new Set(Object.values(COURIER_NAME_TO_KA_CODE))];

/**
 * Cek apakah sebuah rate dari KiriminAja cocok dengan salah satu nama
 * ekspedisi produk. Dipakai untuk client‑side filtering di form order.
 *
 * Strategi pencocokan (berurutan, berhenti saat pertama cocok):
 * 1. Kode KA hasil mapping = `rate.service` → exact match
 * 2. Nama ekspedisi (mentah) muncul di dalam `service_name` rate
 * 3. Kombinasi `service_name` + `service` mengandung kode KA
 * 4. Salah satu kata dari nama ekspedisi adalah substring dari `service_name`
 */
export function matchEkspedisi(rate: { service: string; service_name: string }, ekspedisiList: string[]): boolean {
  const kaCode = rate.service.toLowerCase();
  const hay = normalizeCourierName(`${rate.service_name} ${rate.service}`);

  for (const raw of ekspedisiList) {
    const norm = normalizeCourierName(raw);
    // 1) Kode KA hasil mapping → cocok langsung dengan service
    const ka = COURIER_NAME_TO_KA_CODE[norm] ?? norm;
    if (ka === kaCode) return true;

    // 2) Kombinasi service_name+service mengandung kode KA (atau sebaliknya)
    if (hay.includes(ka) || ka.includes(hay)) return true;

    // 3) Fuzzy: HANYA jika nama tidak dikenali (tidak ada di mapping),
    //    coba cek apakah nama mengandung kode KA yang dikenal sbg substring.
    if (!COURIER_NAME_TO_KA_CODE[norm]) {
      for (const code of ALL_KA_CODES) {
        if (code.length < 3) continue; // kode terlalu pendek rawan false positive
        if (norm.includes(code) && code === kaCode) return true;
      }
    }

    // 4) Fuzzy longgar: kata dari service_name (min 3 karakter) muncul di nama ekspedisi
    //    HANYA jika kode KA hasil mapping tidak dikenal (fallback untuk nama custom)
    if (!COURIER_NAME_TO_KA_CODE[norm]) {
      const serviceWords = normalizeCourierName(rate.service_name).split(/\s+/);
      if (serviceWords.some((w) => w.length >= 3 && norm.includes(w))) return true;
    }
  }

  return false;
}

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

  // Jika proxy URL diset, gunakan proxy (Cloudflare Worker) sebagai perantara.
  // Proxy akan menangani X-Forwarded-For sehingga request lolos IP whitelist.
  if (PROXY_URL) {
    return kaPostViaProxy<T>(path, body);
  }

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
          ...(XFF_IP ? { "X-Forwarded-For": XFF_IP } : {}),
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

/** Panggil KiriminAja lewat Cloudflare Worker proxy (bypass IP whitelist). */
async function kaPostViaProxy<T>(path: string, body?: unknown): Promise<KAResponse<T>> {
  const proxyUrl = `${PROXY_URL.replace(/\/+$/, "")}${path}`;
  const payload = JSON.stringify(body ?? {});

  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Length": String(Buffer.byteLength(payload)),
    },
    body: payload,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok && res.status !== 200) {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json?.status === false) {
        throw new Error(json?.text ?? "KiriminAja menolak permintaan (via proxy)");
      }
    } catch {
      // bukan JSON
    }
    throw new Error(`Proxy KiriminAja error (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as KAResponse<T>;

  if (json?.status === false) {
    throw new Error(json?.text ?? "KiriminAja menolak permintaan (via proxy)");
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
  /** ID kecamatan pengirim. Default: KIRIMINAJA_ORIGIN_DISTRICT (toko). */
  origin?: number | string;
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
 * `origin` default dari KIRIMINAJA_ORIGIN_DISTRICT (kecamatan toko);
 * bisa dioverride per produk sesuai lokasi seller (origin-resolver.ts).
 */
export async function getRates(input: GetRatesInput): Promise<KARateResult> {
  const originRaw = input.origin ?? process.env.KIRIMINAJA_ORIGIN_DISTRICT;
  const origin = Number(originRaw);
  if (!origin || !Number.isFinite(origin)) {
    throw new Error("KIRIMINAJA_ORIGIN_DISTRICT belum diatur di .env.local");
  }

  const destination = Number(input.destination);
  const courierKey = input.courier?.length ? input.courier.sort().join(",") : "all";
  const cacheKey = `rates:${origin}:${destination}:${input.weight}:${input.itemValue ?? 0}:${courierKey}`;

  return cached(cacheKey, async () => {
    const payload: Record<string, unknown> = {
      origin,
      destination,
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
      origin,
      destination,
      weight: input.weight,
      results: json.results ?? [],
    };
  });
}
