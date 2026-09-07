import { NextResponse } from "next/server";
import { anekaClient } from "@/lib/anekadropship";

export const dynamic = "force-dynamic";

// Simple in-memory cache for categories (clear on restart).
let cache: { data: unknown; ts: number } | null = null;
const TTL = 5 * 60_000; // 5 minutes

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const categories = await anekaClient.getCategories();
    const data = { categories };
    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch categories" },
      { status: 502 },
    );
  }
}
