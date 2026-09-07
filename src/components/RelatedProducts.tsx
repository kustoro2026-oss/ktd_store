"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import ProductCard from "./ProductCard";
import { useApi } from "@/lib/useApi";
import type { AnekaProduct } from "@/lib/anekadropship";

const STOPWORDS = new Set([
  "dan", "atau", "yang", "di", "ke", "dengan", "untuk", "pada", "ini", "itu",
  "the", "of", "and", "a", "an",
]);

/** First significant word of the product name — used to find similar items. */
function searchKeyword(name: string): string {
  const words = name.replace(/[^a-z0-9\s]/gi, " ").split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  return (kept[0] ?? words[0] ?? "").slice(0, 30);
}

function RelatedSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-gray-100 bg-white">
          <div className="aspect-[4/3] animate-pulse bg-gray-100" />
          <div className="space-y-2 p-3">
            <div className="h-3 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Highlighted "similar products" panel shown under the product description.
 * Searches by the product's first significant word; falls back to the newest
 * products when there aren't enough matches.
 */
export default function RelatedProducts({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const kw = searchKeyword(productName);
  const searchUrl = kw ? `/api/products?search=${encodeURIComponent(kw)}&page=1` : null;
  const { data: searchData, loading: searchLoading } = useApi<{ products: AnekaProduct[] }>(searchUrl);
  const { data: fallbackData, loading: fallbackLoading } = useApi<{ products: AnekaProduct[] }>(
    "/api/products?sort=newest&page=1",
  );

  const related = (searchData?.products ?? []).filter((p) => p.id !== productId);
  const fallback = (fallbackData?.products ?? []).filter((p) => p.id !== productId);
  const items = related.length >= 4 ? related : fallback;
  const shown = items.slice(0, 8);

  if (searchLoading || fallbackLoading) return <RelatedSkeleton />;
  if (!shown.length) return null;

  return (
    <section className="mt-12 rounded-2xl border border-brand/15 bg-brand/5 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink sm:text-2xl">
            <Sparkles className="h-5 w-5 text-brand" />
            Produk Serupa
          </h2>
          <p className="mt-1 text-sm text-muted">Rekomendasi produk yang mungkin Anda suka</p>
        </div>
        {kw ? (
          <Link
            href={`/produk?search=${encodeURIComponent(kw)}`}
            className="whitespace-nowrap text-sm font-semibold text-brand hover:underline"
          >
            Lihat Semua →
          </Link>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {shown.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}
