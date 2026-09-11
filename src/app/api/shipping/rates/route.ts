import { getRates, upstreamError, type KARate } from "@/lib/kiriminaja";
import { getDetailCached } from "@/lib/detail-cache";
import { fallbackOriginDistrict, resolveOriginDistrict } from "@/lib/origin-resolver";

type RateGroup = {
  /** ID kecamatan pengirim (origin). */
  origin: number;
  /** Label lokasi seller untuk ditampilkan (mis. alamat gudang). */
  label: string;
  /** Total berat paket grup ini (gram). */
  weight: number;
  /** Berat estimasi untuk item yang datanya tidak tersedia. */
  estimated?: boolean;
  results: KARate[];
};

const DEFAULT_ITEM_WEIGHT = 1000; // gram — dipakai jika data berat item tidak ada

export async function POST(request: Request) {
  let body: {
    destination?: unknown;
    weight?: unknown;
    itemValue?: unknown;
    courier?: unknown;
    productId?: unknown;
    productIds?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  const destination = Number(body.destination);
  if (!destination || !Number.isFinite(destination)) {
    return Response.json({ error: "Kecamatan tujuan wajib dipilih" }, { status: 400 });
  }

  const itemValue = Number(body.itemValue);
  const courier = Array.isArray(body.courier)
    ? (body.courier as string[]).map(String)
    : undefined;

  const ids = Array.isArray(body.productIds)
    ? (body.productIds as unknown[]).map(String).filter(Boolean)
    : typeof body.productId === "string" && body.productId
      ? [body.productId]
      : [];

  const fallbackWeight = Number(body.weight);

  try {
    if (ids.length > 0) {
      const groups = await rateGroupsForProducts({
        ids,
        destination,
        itemValue: Number.isFinite(itemValue) && itemValue > 0 ? itemValue : undefined,
        courier,
        fallbackWeight,
      });
      return Response.json({ groups, destination });
    }

    // Jalur lama tanpa produk: pakai origin global toko + berat dari klien.
    const weight = Math.round(fallbackWeight);
    if (!weight || !Number.isFinite(weight) || weight < 1) {
      return Response.json({ error: "Berat paket wajib diisi (gram)" }, { status: 400 });
    }
    const origin = fallbackOriginDistrict();
    if (!origin) {
      return upstreamError("KIRIMINAJA_ORIGIN_DISTRICT belum diatur di .env.local");
    }
    const result = await getRates({
      origin,
      destination,
      weight,
      itemValue: Number.isFinite(itemValue) && itemValue > 0 ? itemValue : undefined,
      courier,
    });
    return Response.json({
      groups: [{ origin, label: "Dikirim dari gudang KTD Store", weight, results: result.results }],
      destination,
    });
  } catch (e) {
    return upstreamError(e instanceof Error ? e.message : "Gagal menghitung ongkir");
  }
}

/**
 * Hitung ongkir per kelompok seller: setiap produk dipetakan ke kecamatan
 * asal seller-nya, lalu barang dengan origin sama digabung jadi satu paket.
 */
async function rateGroupsForProducts(opts: {
  ids: string[];
  destination: number;
  itemValue?: number;
  courier?: string[];
  fallbackWeight: number;
}): Promise<RateGroup[]> {
  const { ids, destination, itemValue, courier, fallbackWeight } = opts;

  // 1) Kumpulkan origin + berat tiap produk (detail di-cache 5 menit).
  const entries = new Map<
    number,
    { origin: number; label: string; weight: number; estimated: boolean; count: number }
  >();
  for (const id of [...new Set(ids)]) {
    const detail = await getDetailCached(id);
    if (!detail?.name) continue; // produk tidak ditemukan — lewati

    const origin = resolveOriginDistrict({
      productId: id,
      alamatSeller: detail.alamatSeller,
    });
    const districtId = origin?.districtId ?? fallbackOriginDistrict();
    if (!districtId) {
      throw new Error("KIRIMINAJA_ORIGIN_DISTRICT belum diatur di .env.local");
    }

    const knownWeight = detail.beratGram;
    const weight = knownWeight && knownWeight > 0 ? knownWeight : DEFAULT_ITEM_WEIGHT;
    const label = detail.alamatSeller
      ? detail.alamatSeller
      : origin?.source === "produk" || origin?.source === "alamat"
        ? "Dikirim dari gudang seller"
        : "Dikirim dari gudang KTD Store";

    const prev = entries.get(districtId);
    if (prev) {
      prev.weight += weight;
      prev.estimated = prev.estimated || !knownWeight;
      prev.count += 1;
    } else {
      entries.set(districtId, {
        origin: districtId,
        label,
        weight,
        estimated: !knownWeight,
        count: 1,
      });
    }
  }

  if (entries.size === 0) {
    throw new Error("Produk tidak ditemukan. Coba muat ulang halaman produk.");
  }

  // 2) Hitung tarif per grup (origin berbeda = pengiriman terpisah).
  const groups: RateGroup[] = [];
  const multi = entries.size > 1;
  const fallbackPerItem = fallbackWeight > 0 ? fallbackWeight / ids.length : 0;
  for (const g of entries.values()) {
    // Berat total minimal 1 gram. Item tanpa data berat pakai estimasi
    // (default 1000 gr atau rata-rata berat input manual bila tersedia).
    const weight = Math.max(1, Math.round(g.weight));
    const result = await getRates({
      origin: g.origin,
      destination,
      weight,
      // Asuransi hanya untuk paket tunggal (nilai item tidak bisa dipecah per paket).
      itemValue: multi ? undefined : itemValue,
      courier,
    });
    groups.push({
      origin: g.origin,
      label: g.label,
      weight: g.count === 1 ? weight : Math.round(g.weight) || weight,
      estimated: g.estimated || Boolean(fallbackPerItem),
      results: result.results,
    });
  }

  return groups;
}
