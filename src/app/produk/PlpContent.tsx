"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { useApi } from "@/lib/useApi";
import CategoryIcon from "@/components/CategoryIcon";
import type { AnekaCategory, AnekaProduct } from "@/lib/anekadropship";

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4">
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

/** Windowed pagination: 1 … around current … total (never a wall of pages). */
function paginationItems(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...wanted]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const items: (number | "...")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) items.push("...");
    items.push(n);
    prev = n;
  }
  return items;
}

type Props = {
  /** Server-rendered category list (null = upstream unreachable → fetch client-side). */
  categories: AnekaCategory[] | null;
  /** Server-rendered product list for this page (null → fetch client-side). */
  products: AnekaProduct[] | null;
  /** Total pages from the server render (only meaningful when `products` is set). */
  totalPages: number;
  category: string;
  search: string;
  page: number;
};

export default function PlpContent({
  categories: initialCategories,
  products: initialProducts,
  totalPages: initialTotalPages,
  category,
  search,
  page,
}: Props) {
  // Fall back to client fetching when the server couldn't reach the upstream.
  const { data: catData } = useApi<{ categories: AnekaCategory[] }>(
    initialCategories ? null : "/api/categories",
  );
  const { data: prodData, loading, error } = useApi<{
    products: AnekaProduct[];
    totalPages: number;
  }>(
    initialProducts
      ? null
      : `/api/products?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&page=${page}`,
  );

  const categories = initialCategories ?? catData?.categories ?? [];
  const products = initialProducts ?? prodData?.products ?? [];
  const totalPages = initialProducts ? initialTotalPages : (prodData?.totalPages ?? 1);

  const catName =
    categories.find((c) => c.slug.toLowerCase() === category.toLowerCase())?.name ?? category;

  const buildUrl = (p: number) =>
    `/produk?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&page=${p}`;

  const title = search
    ? `Hasil pencarian "${search}"`
    : category
      ? `Kategori: ${catName}`
      : "Semua Produk";

  const hasFilter = Boolean(search || category);

  return (
    <div className="container-site py-5">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <Link href="/produk" className="transition-colors hover:text-brand">Produk</Link>
        {category && (
          <>
            <span>/</span>
            <span className="truncate text-muted">{catName}</span>
          </>
        )}
      </nav>

      <div className="flex gap-6">
        {/* Sidebar categories (desktop) */}
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-32 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <h3 className="mb-2 px-2 text-sm font-bold text-ink">Kategori</h3>
            <ul className="max-h-[65vh] space-y-0.5 overflow-y-auto text-sm thin-scroll">
              <li>
                <Link
                  href="/produk"
                  className={`block rounded-lg px-2.5 py-2 ${!category ? "bg-brand/5 font-semibold text-brand" : "text-muted transition-colors hover:bg-gray-50 hover:text-brand"}`}
                >
                  Semua Kategori
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/produk?category=${encodeURIComponent(c.slug)}`}
                    className={`block rounded-lg px-2.5 py-2 ${category === c.slug ? "bg-brand/5 font-semibold text-brand" : "text-muted transition-colors hover:bg-gray-50 hover:text-brand"}`}
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="mb-4">
            <h1 className="text-xl font-bold text-ink sm:text-2xl">{title}</h1>
            {hasFilter && (
              <Link
                href="/produk"
                className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand/5 px-3 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand/10"
              >
                Reset filter
                <X className="h-3 w-3" />
              </Link>
            )}
          </div>

          {/* Mobile category chips */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 md:hidden scrollbar-hide">
            <Link
              href="/produk"
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${!category ? "border-brand bg-brand text-white" : "border-gray-200 bg-white text-muted"}`}
            >
              Semua
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/produk?category=${encodeURIComponent(c.slug)}`}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${category === c.slug ? "border-brand bg-brand text-white" : "border-gray-200 bg-white text-muted"}`}
              >
                <CategoryIcon slug={c.slug} className="h-3.5 w-3.5" />
                {c.name}
              </Link>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <GridSkeleton />
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-white py-20 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 text-muted-2">
                <Search className="h-7 w-7" />
              </div>
              <p className="mt-4 font-semibold text-ink">Tidak ada produk ditemukan</p>
              <p className="mt-1 text-sm text-muted">Coba kata kunci atau kategori lain.</p>
              <Link
                href="/produk"
                className="mt-4 inline-block rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2"
              >
                Lihat Semua Produk
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4">
                {products.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
              <Link
                href={buildUrl(Math.max(1, page - 1))}
                aria-label="Halaman sebelumnya"
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm ${page <= 1 ? "pointer-events-none border-gray-100 text-gray-300" : "border-gray-200 transition-colors hover:border-brand hover:text-brand"}`}
              >
                ‹
              </Link>
              {paginationItems(page, totalPages).map((n, i) =>
                n === "..." ? (
                  <span key={`gap-${i}`} className="px-1 text-sm text-muted-2">
                    …
                  </span>
                ) : (
                  <Link
                    key={n}
                    href={buildUrl(n)}
                    className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm ${n === page ? "border-brand bg-brand font-semibold text-white" : "border-gray-200 transition-colors hover:border-brand hover:text-brand"}`}
                  >
                    {n}
                  </Link>
                )
              )}
              <Link
                href={buildUrl(Math.min(totalPages, page + 1))}
                aria-label="Halaman berikutnya"
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm ${page >= totalPages ? "pointer-events-none border-gray-100 text-gray-300" : "border-gray-200 transition-colors hover:border-brand hover:text-brand"}`}
              >
                ›
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
