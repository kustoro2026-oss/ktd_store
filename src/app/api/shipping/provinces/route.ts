import { getProvinces, upstreamError } from "@/lib/kiriminaja";

export async function GET() {
  try {
    const provinces = await getProvinces();
    return Response.json({ provinces });
  } catch (e) {
    return upstreamError(e instanceof Error ? e.message : "Gagal memuat provinsi");
  }
}
