// Resolusi origin (kecamatan pengirim) per produk, dari lokasi seller anekadropship.
// Data statis di seller-origins.json dibuat oleh scripts/build-origin-map.ts.
// Prioritas: id produk -> alamat seller -> kota. Fallback: env global toko.
import sellerOrigins from "./seller-origins.json";

type OriginMap = {
  byProductId?: Record<string, number>;
  byAddress?: Record<string, number>;
  byLocation?: Record<string, number>;
};

const MAP = sellerOrigins as OriginMap;

/** Lowercase, buang tanda baca, satukan spasi. */
export function normalizeOriginKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export type OriginResolution = {
  /** ID kecamatan KiriminAja (origin shipping_price). */
  districtId: number;
  /** Sumber kecocokan: "produk" | "alamat" | "kota". */
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
  }
  return null;
}

/** Origin global dari env (kecamatan toko KTD Store) — fallback terakhir. */
export function fallbackOriginDistrict(): number | null {
  const v = process.env.KIRIMINAJA_ORIGIN_DISTRICT;
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : null;
}
