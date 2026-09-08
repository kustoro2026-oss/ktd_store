import { getCities, upstreamError } from "@/lib/kiriminaja";

export async function GET(request: Request) {
  const provinsiId = new URL(request.url).searchParams.get("provinsi_id");
  if (!provinsiId) {
    return Response.json({ error: "provinsi_id wajib diisi" }, { status: 400 });
  }
  try {
    const cities = await getCities(provinsiId);
    return Response.json({ cities });
  } catch (e) {
    return upstreamError(e instanceof Error ? e.message : "Gagal memuat kota");
  }
}
