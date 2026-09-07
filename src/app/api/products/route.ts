import { NextRequest, NextResponse } from "next/server";
import { anekaClient } from "@/lib/anekadropship";

// Simple in-memory cache (per server instance). Clear on restart.
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 60_000; // 1 minute

// Never statically optimize this route (it fetches external data at runtime).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = {
    search: searchParams.get("search") ?? "",
    category: searchParams.get("category") ?? "",
    location: searchParams.get("location") ?? "all",
    seller: searchParams.get("seller") ?? "all",
    page: Number(searchParams.get("page") ?? "1"),
  };
  const sort = searchParams.get("sort") ?? "";

  const key = `${query.search}|${query.category}|${query.location}|${query.seller}|${query.page}|${sort}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json(hit.data);
  }

  try {
    const { products, totalPages } =
      sort === "newest"
        ? await anekaClient.getNewestProducts(query)
        : await anekaClient.getProducts(query);
    const data = { products, page: query.page, totalPages };
    cache.set(key, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch products" },
      { status: 502 },
    );
  }
}
