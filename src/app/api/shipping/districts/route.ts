import { getDistricts, upstreamError } from "@/lib/kiriminaja";

export async function GET(request: Request) {
  const kabupatenId = new URL(request.url).searchParams.get("kabupaten_id");
  if (!kabupatenId) {
    return Response.json({ error: "kabupaten_id wajib diisi" }, { status: 400 });
  }
  try {
    const districts = await getDistricts(kabupatenId);
    return Response.json({ districts });
  } catch (e) {
    return upstreamError(e instanceof Error ? e.message : "Gagal memuat kecamatan");
  }
}
