import { NextRequest, NextResponse } from "next/server";
import { toLocalImages } from "@/lib/localImages";
import { getStaticProducts } from "@/lib/products-cache";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const products = getStaticProducts();
  const p = products.find((p) => p.id === id);

  if (!p) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Basic detail from static cache.
  // Full description & variants come from manual scrape script.
  const detail = {
    id: p.id,
    name: p.name,
    images: toLocalImages(p.id, (p as { images?: string[] }).images ?? [p.image].filter(Boolean)),
    descriptionHtml: (p as { descriptionHtml?: string }).descriptionHtml ?? "",
    rekomendasiJual: p.rekomendasiJual ?? "Rp -",
    hargaModal: (p as { hargaModal?: string }).hargaModal ?? "",
    stok: p.stok ?? "0",
    terjual: (p as { terjual?: string }).terjual ?? "0",
    profit: "",
    sku: "",
    berat: (p as { berat?: string }).berat ?? "",
    beratGram: (p as { beratGram?: number | null }).beratGram ?? null,
    volume: (p as { volume?: string }).volume ?? "",
    ekspedisi: (p as { ekspedisi?: string }).ekspedisi ?? "",
    ekspedisiList: (p as { ekspedisiList?: string[] }).ekspedisiList ?? [],
    sistem: "",
    alamatSeller: (p as { alamatSeller?: string }).alamatSeller ?? "",
    hasVariants: false,
    variants: [],
    marketingKitUrl: null,
  };

  return NextResponse.json(detail, { headers: CACHE_HEADERS });
}
