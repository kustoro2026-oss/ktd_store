import { getProvinces } from "@/lib/kiriminaja";

export async function GET() {
  try {
    const provinces = await getProvinces();
    return Response.json({ provinces });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Gagal memuat provinsi" },
      { status: 502 }
    );
  }
}
