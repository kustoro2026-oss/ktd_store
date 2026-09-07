"use client";

import Link from "next/link";
import { MessageCircle, ShieldCheck, ShoppingCart, Tag } from "lucide-react";
import ProductCard from "./ProductCard";
import { useApi } from "@/lib/useApi";
import CategoryIcon from "@/components/CategoryIcon";
import type { AnekaCategory, AnekaProduct } from "@/lib/anekadropship";

/* Trust / value proposition strip */
export function Features() {
  const items = [
    { icon: Tag, title: "Langsung dari supplier", desc: "" },
    { icon: ShoppingCart, title: "Pesan via WhatsApp", desc: "Cepat & praktis" },
    { icon: ShieldCheck, title: "Transaksi Aman", desc: "Pesanan terlindungi" },
    { icon: MessageCircle, title: "CS Siap Bantu", desc: "Setiap hari via WhatsApp" },
  ];
  return (
    <section className="container-site mt-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map((it) => (
          <div
            key={it.title}
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/5 text-brand">
              <it.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{it.title}</p>
              {it.desc ? <p className="truncate text-xs text-muted-2">{it.desc}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* Kategori (real categories from anekadropship.id) */
export function PopularCategories({
  initialCategories,
}: {
  initialCategories?: AnekaCategory[] | null;
}) {
  // Server-rendered data (homepage ISR) — skip the client fetch when present.
  const { data, loading } = useApi<{ categories: AnekaCategory[] }>(
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
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {categories.slice(0, 16).map((c) => (
            <Link
              key={c.slug}
              href={`/produk?category=${encodeURIComponent(c.slug)}`}
              className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/5 text-brand transition-transform group-hover:scale-110">
                <CategoryIcon slug={c.slug} className="h-6 w-6" />
              </span>
              <span className="clamp-2 text-xs font-medium leading-tight text-ink">{c.name}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* Produk Terbaru (real products from anekadropship.id) */
export function NewProducts({
  initialProducts,
}: {
  initialProducts?: AnekaProduct[] | null;
}) {
  // Server-rendered data (homepage ISR) — skip the client fetch when present.
  const { data, loading } = useApi<{ products: AnekaProduct[] }>(
    initialProducts ? null : "/api/products?sort=newest&page=1",
  );
  const products = initialProducts ?? data?.products ?? [];

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
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {products.slice(0, 10).map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}
