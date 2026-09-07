import { getRates } from "@/lib/kiriminaja";

export async function POST(request: Request) {
  let body: { destination?: unknown; weight?: unknown; itemValue?: unknown; courier?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  const destination = Number(body.destination);
  const weight = Number(body.weight);
  if (!destination || !Number.isFinite(destination)) {
    return Response.json({ error: "Kecamatan tujuan wajib dipilih" }, { status: 400 });
  }
  if (!weight || !Number.isFinite(weight) || weight < 1) {
    return Response.json({ error: "Berat paket wajib diisi (gram)" }, { status: 400 });
  }

  const itemValue = Number(body.itemValue);
  const courier = Array.isArray(body.courier)
    ? (body.courier as string[]).map(String)
    : undefined;

  try {
    const result = await getRates({
      destination,
      weight: Math.round(weight),
      itemValue: Number.isFinite(itemValue) && itemValue > 0 ? itemValue : undefined,
      courier,
    });
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Gagal menghitung ongkir" },
      { status: 502 }
    );
  }
}
