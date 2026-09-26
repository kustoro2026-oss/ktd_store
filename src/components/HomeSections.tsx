"use client";

import Link from "next/link";
import ProductCard from "./ProductCard";
import { useApi } from "@/lib/useApi";
import CategoryIcon from "@/components/CategoryIcon";
import { saveLastCategory } from "@/components/BestSellers";
import { SALT_BARU } from "@/lib/hourlyProducts";
import { useHourlyProducts } from "@/lib/useHourlyProducts";
import type { AnekaCategory, AnekaProduct, CardProduct } from "@/lib/anekadropship";

/* Kategori (real categories from anekadropship.id) */
export function PopularCategories({
  initialCategories,
}: {
  initialCategories?: AnekaCategory[] | null;
}) {
  // Server-rendered data (homepage ISR) — skip the client fetch when present.
  const { data, loading, error } = useApi<{ categories: AnekaCategory[] }>(
    initialCategories ? null : "/api/categories",
  );
  const categories = initialCategories ?? data?.categories ?? [];

  return (
    <section className="container-site mt-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink sm:text-2xl">Kategori Populer</h2>
          <p className="mt-1 text-sm text-muted">Jelajahi produk berdasarkan kategori</p>
        </div>
        <Link href="/produk" className="whitespace-nowrap text-sm font-semibold text-brand hover:underline">
          Lihat Semua →
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="flex h-24 animate-pulse flex-col items-center justify-center gap-2 rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : categories.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {categories.slice(0, 16).map((c) => (
            <Link
              key={c.slug}
              href={`/produk?category=${encodeURIComponent(c.slug)}`}
              onClick={() => saveLastCategory(c.slug)}
              className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/5 text-brand transition-transform group-hover:scale-110">
                <CategoryIcon slug={c.slug} className="h-6 w-6" />
              </span>
              <span className="clamp-2 text-xs font-medium leading-tight text-ink">{c.name}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
          <p className="text-sm text-muted-2">
            {error ? "Kategori sedang tidak tersedia. Silakan coba beberapa saat lagi." : "Belum ada kategori."}
          </p>
        </div>
      )}
    </section>
  );
}

/* Produk Terbaru — 16 aneka + 16 Evermos, acak & berganti tiap jam */
export function NewProducts({
  anekaPool,
  evmPool,
  initialItems,
  initialSeed,
}: {
  anekaPool: CardProduct[];
  evmPool: CardProduct[];
  initialItems: CardProduct[];
  initialSeed: number;
}) {
  const hasPool = anekaPool.length > 0 || evmPool.length > 0;
  // Fallback jarang: pool statis kosong → ambil live dari API aneka.
  const { data, loading, error } = useApi<{ products: AnekaProduct[] }>(
    hasPool ? null : "/api/products?sort=newest&page=1",
  );
  const hourly = useHourlyProducts(anekaPool, evmPool, initialItems, initialSeed, SALT_BARU);
  const products: CardProduct[] = hasPool ? hourly : (data?.products ?? []).slice(0, 32);

  return (
    <section className="container-site mt-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink sm:text-2xl">Produk Terbaru</h2>
          <p className="mt-1 text-sm text-muted">Produk pilihan terbaru untuk Anda</p>
        </div>
        <Link href="/produk" className="whitespace-nowrap text-sm font-semibold text-brand hover:underline">
          Lihat Semua →
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
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
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
          <p className="text-sm text-muted-2">
            {error ? "Produk sedang tidak tersedia. Silakan coba beberapa saat lagi." : "Belum ada produk."}
          </p>
        </div>
      )}
    </section>
  );
}
