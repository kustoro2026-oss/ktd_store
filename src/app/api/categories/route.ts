import { NextResponse } from "next/server";
import { getStaticCategories } from "@/lib/products-cache";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
  const categories = getStaticCategories();
  return NextResponse.json({ categories }, { headers: CACHE_HEADERS });
}
