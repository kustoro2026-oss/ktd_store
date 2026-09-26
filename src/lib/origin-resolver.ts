// Resolusi origin (kecamatan pengirim) per produk, dari lokasi seller anekadropship.
// Data statis di seller-origins.json dibuat oleh scripts/build-origin-map.ts.
// Prioritas: id produk -> alamat seller -> kota -> default kota (perkiraan) ->
// fallback env global toko. Default kota dipakai bila produk hanya punya badge
// kota tanpa alamat (mis. katalog Evermos): memakai kecamatan perwakilan kota
// dari city-origin-defaults.json agar ongkir tidak jatuh ke gudang KTD.
import sellerOrigins from "./seller-origins.json";
import cityOriginDefaults from "./city-origin-defaults.json";

type OriginMap = {
  byProductId?: Record<string, number>;
  byAddress?: Record<string, number>;
  byLocation?: Record<string, number>;
};

const MAP = sellerOrigins as OriginMap;
/** Kota (ternormalisasi) -> kecamatan perwakilan — perkiraan, lihat file JSON. */
const CITY_DEFAULTS = cityOriginDefaults as Record<string, number>;

/** Lowercase, buang tanda baca, satukan spasi. */
export function normalizeOriginKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export type OriginResolution = {
  /** ID kecamatan KiriminAja (origin shipping_price). */
  districtId: number;
  /** Sumber kecocokan: "produk" | "alamat" | "kota" | "kota-default". */
  source: string;
};

/** Resolusi kecamatan asal untuk satu produk. null jika belum ada di peta. */
export function resolveOriginDistrict(opts: {
  productId?: string;
  alamatSeller?: string;
  location?: string;
}): OriginResolution | null {
  if (opts.productId && MAP.byProductId?.[opts.productId]) {
    return { districtId: MAP.byProductId[opts.productId], source: "produk" };
  }
  if (opts.alamatSeller) {
    const key = normalizeOriginKey(opts.alamatSeller);
    const v = MAP.byAddress?.[key];
    if (v) return { districtId: v, source: "alamat" };
  }
  if (opts.location) {
    const key = normalizeOriginKey(opts.location);
    const v = MAP.byLocation?.[key];
    if (v) return { districtId: v, source: "kota" };
    const d = CITY_DEFAULTS[key];
    if (d) return { districtId: d, source: "kota-default" };
  }
  return null;
}

/** Origin global dari env (kecamatan toko KTD Store) — fallback terakhir. */
export function fallbackOriginDistrict(): number | null {
  const v = process.env.KIRIMINAJA_ORIGIN_DISTRICT;
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : null;
}
