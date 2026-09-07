import { NextRequest, NextResponse } from "next/server";
import { anekaClient } from "@/lib/anekadropship";

export const dynamic = "force-dynamic";

// Simple in-memory cache for product details (clear on restart).
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 5 * 60_000; // 5 minutes

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const hit = cache.get(id);
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json(hit.data);
  }

  try {
    const detail = await anekaClient.getProductDetail(id);
    cache.set(id, { data: detail, ts: Date.now() });
    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch product" },
      { status: 502 },
    );
  }
}
