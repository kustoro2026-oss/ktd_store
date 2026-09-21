import { NextRequest, NextResponse } from "next/server";
import { filterByRelevance } from "@/lib/search";
import { getLocalImages } from "@/lib/localImages";
import { getStaticProducts } from "@/lib/products-cache";

export const dynamic = "force-dynamic";

type Suggestion = { id: string; name: string; image: string };

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

const LIMIT = 8;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ suggestions: [] });

  const products = getStaticProducts();
  const suggestions: Suggestion[] = filterByRelevance(products, q)
    .slice(0, LIMIT)
    .map((p) => {
      const local = getLocalImages(p.id);
      return {
        id: p.id,
        name: p.name,
        image: local.length ? local[0] : p.image,
      };
    });

  return NextResponse.json({ suggestions }, { headers: CACHE_HEADERS });
}
