"use client";

import Link from "next/link";
import ProductCard from "./ProductCard";
import { useApi } from "@/lib/useApi";
import { SALT_LARIS } from "@/lib/hourlyProducts";
import { useHourlyProducts } from "@/lib/useHourlyProducts";
import type { AnekaProduct, CardProduct } from "@/lib/anekadropship";
import { TrendingUp } from "lucide-react";

const STORAGE_KEY = "ktd-last-category";

/** Simpan kategori terakhir yang diklik (dipakai PopularCategories). */
export function saveLastCategory(slug: string) {
    try { localStorage.setItem(STORAGE_KEY, slug); } catch { /* ignore */ }
}

/* Produk Terlaris — pool 16 aneka + 16 Evermos terlaris, acak & berganti tiap jam */
export default function BestSellers({
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
    const { data, loading } = useApi<{ products: AnekaProduct[] }>(
        hasPool ? null : "/api/products?sort=newest&page=1",
    );
    const hourly = useHourlyProducts(anekaPool, evmPool, initialItems, initialSeed, SALT_LARIS);
    const products: CardProduct[] = hasPool ? hourly : (data?.products ?? []).slice(0, 32);

    if (loading) {
        return (
            <section className="container-site mt-10">
                <div className="mb-4 flex items-end justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-ink sm:text-2xl">Produk Terlaris</h2>
                        <p className="mt-1 text-sm text-muted">Produk paling banyak diminati</p>
                    </div>
                </div>
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
            </section>
        );
    }

    if (!products.length) return null;

    return (
        <section className="container-site mt-10">
            <div className="mb-4 flex items-end justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-bold text-ink sm:text-2xl">
                        <TrendingUp className="h-6 w-6 text-red-500" />
                        Produk Terlaris
                    </h2>
                    <p className="mt-1 text-sm text-muted">Produk paling banyak diminati pembeli</p>
                </div>
                <Link
                    href="/produk"
                    className="whitespace-nowrap text-sm font-semibold text-brand hover:underline"
                >
                    Lihat Semua →
                </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {products.map((p) => (
                    <ProductCard key={p.id} p={p} />
                ))}
            </div>
        </section>
    );
}
