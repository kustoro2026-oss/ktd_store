import { getRates, upstreamError } from "@/lib/kiriminaja";
import { fallbackOriginDistrict } from "@/lib/origin-resolver";
import { rateGroupsForProducts } from "@/lib/shipping-rates";

export async function POST(request: Request) {
  let body: {
    destination?: unknown;
    weight?: unknown;
    qty?: unknown;
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
  const qtyRaw = Number(body.qty);
  const qty =
    Number.isFinite(qtyRaw) && qtyRaw > 1
      ? Math.min(Math.round(qtyRaw), 999)
      : 1;

  try {
    if (ids.length > 0) {
      const groups = await rateGroupsForProducts({
        ids,
        destination,
        itemValue: Number.isFinite(itemValue) && itemValue > 0 ? itemValue : undefined,
        courier,
        fallbackWeight,
        qty,
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
      groups: [
        {
          origin,
          sellerKey: "ktd-store",
          label: "Dikirim dari gudang KTD Store",
          weight,
          itemIds: [],
          results: result.results,
        },
      ],
      destination,
    });
  } catch (e) {
    return upstreamError(e instanceof Error ? e.message : "Gagal menghitung ongkir");
  }
}
