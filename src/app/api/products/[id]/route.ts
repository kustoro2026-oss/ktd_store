import { NextRequest, NextResponse } from "next/server";
import { anekaClient } from "@/lib/anekadropship";
import { toLocalImages } from "@/lib/localImages";

export const dynamic = "force-dynamic";

// Simple in-memory cache for product details (clear on restart).
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 5 * 60_000; // 5 minutes

// Product details are public — let the edge cache absorb repeat views.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const hit = cache.get(id);
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json(hit.data, { headers: CACHE_HEADERS });
  }

  try {
    const detail = await anekaClient.getProductDetail(id);
    // Gunakan gambar lokal (hasil sinkronisasi) agar tidak ada hotlink eksternal.
    detail.images = toLocalImages(detail.id, detail.images);
    cache.set(id, { data: detail, ts: Date.now() });
    return NextResponse.json(detail, { headers: CACHE_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch product" },
      { status: 502 },
    );
  }
}
