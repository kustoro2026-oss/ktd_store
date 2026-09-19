"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import ProductCard from "./ProductCard";
import { rankMatch } from "@/lib/search";
import type { AnekaProduct } from "@/lib/anekadropship";

// Indonesian + English stopwords — words that don't carry product meaning.
const STOPWORDS = new Set([
  "dan", "atau", "yang", "di", "ke", "dengan", "untuk", "pada", "ini", "itu",
  "the", "of", "and", "a", "an", "in", "is", "to", "for", "dari", "bisa",
  "juga", "saja", "sudah", "akan", "telah", "ada", "baru", "original",
  "premium", "best", "top", "hot", "promo", "diskon", "murah", "termurah",
  "berkualitas", "high", "quality", "grade", "super", "limited", "edition",
  "ready", "stok", "tersedia", "cod", "bayar", "tempat", "ditempat",
]);

/** Extract meaningful keywords from a product name, sorted by importance. */
function extractKeywords(name: string): string[] {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  // Filter stopwords and short tokens, keep unique
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const w of words) {
    if (w.length < 3) continue;
    if (STOPWORDS.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    keywords.push(w);
  }
  return keywords;
}

/** Build search queries from most specific to broadest. */
function buildQueries(keywords: string[]): string[] {
  if (keywords.length === 0) return [];
  const queries: string[] = [];
  // Query 1: first 3 keywords (most specific)
  if (keywords.length >= 3) queries.push(keywords.slice(0, 3).join(" "));
  // Query 2: first 2 keywords
  if (keywords.length >= 2) queries.push(keywords.slice(0, 2).join(" "));
  // Query 3: first keyword only (broadest)
  queries.push(keywords[0]);
  return queries;
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

type Props = {
  productId: string;
  productName: string;
};

export default function RelatedProducts({ productId, productName }: Props) {
  const [items, setItems] = useState<AnekaProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKw, setSearchKw] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchRelated() {
      setLoading(true);
      const keywords = extractKeywords(productName);
      const queries = buildQueries(keywords);

      let allProducts: AnekaProduct[] = [];

      // Try each query from most specific to broadest
      for (const q of queries) {
        if (allProducts.length >= 12) break;
        try {
          const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&page=1`);
          const json = (await res.json()) as { products?: AnekaProduct[] };
          const results = (json.products ?? []).filter((p) => p.id !== productId);
          // Merge, deduplicate by id
          const seen = new Set(allProducts.map((p) => p.id));
          for (const p of results) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              allProducts.push(p);
            }
          }
        } catch {
          // Continue to next query
        }
      }

      // If still not enough, fetch newest as fallback
      if (allProducts.length < 4) {
        try {
          const res = await fetch("/api/products?sort=newest&page=1");
          const json = (await res.json()) as { products?: AnekaProduct[] };
          const fallback = (json.products ?? [])
            .filter((p) => p.id !== productId)
            .filter((p) => !allProducts.some((x) => x.id === p.id));
          allProducts = [...allProducts, ...fallback];
        } catch {
          // Silent
        }
      }

      if (cancelled) return;

      // Client-side re-rank: score each product by similarity to the original
      const scored = allProducts.map((p) => ({
        p,
        score: rankMatch(p.name, productName),
      }));
      // Sort: lower rank = better match. Unmatched (rank -1) go to the end.
      scored.sort((a, b) => {
        if (a.score === -1 && b.score === -1) return 0;
        if (a.score === -1) return 1;
        if (b.score === -1) return -1;
        return a.score - b.score;
      });

      setItems(scored.map((x) => x.p).slice(0, 8));
      setSearchKw(queries[queries.length - 1] ?? keywords[0] ?? "");
      setLoading(false);
    }

    fetchRelated();
    return () => { cancelled = true; };
  }, [productId, productName]);

  if (loading) return <RelatedSkeleton />;
  if (!items.length) return null;

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
        {searchKw ? (
          <Link
            href={`/produk?search=${encodeURIComponent(searchKw)}`}
            className="whitespace-nowrap text-sm font-semibold text-brand hover:underline"
          >
            Lihat Semua →
          </Link>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}
