"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import ProductCard from "./ProductCard";
import { useApi } from "@/lib/useApi";
import type { AnekaProduct } from "@/lib/anekadropship";
import { TrendingUp, Sparkles } from "lucide-react";

/** Fisher-Yates shuffle. */
function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Parse "7,7rb" → 7700, "1,2RB" → 1200, "500" → 500 */
function parseSold(sold: string): number {
    if (!sold) return 0;
    const s = sold.toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
    const rb = s.match(/^([\d,]+)rb$/);
    if (rb) return Math.round(parseFloat(rb[1].replace(",", ".")) * 1000);
    const k = s.match(/^([\d,]+)k$/);
    if (k) return Math.round(parseFloat(k[1].replace(",", ".")) * 1000);
    return parseInt(s, 10) || 0;
}

const STORAGE_KEY = "ktd-last-category";

function getLastCategory(): string | null {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function saveLastCategory(slug: string) {
    try { localStorage.setItem(STORAGE_KEY, slug); } catch { /* ignore */ }
}

export default function BestSellers() {
    const { data, loading } = useApi<{ products: AnekaProduct[] }>(
        "/api/products?sort=newest&page=1",
    );
    const [preferredCat, setPreferredCat] = useState<string | null>(null);

    useEffect(() => {
        setPreferredCat(getLastCategory());
    }, []);

    const products = useMemo(() => {
        const all = data?.products ?? [];
        if (!all.length) return [];

        // Sort by sold count (highest first)
        const sorted = [...all].sort((a, b) => parseSold(b.terjual) - parseSold(a.terjual));

        // If user has a preferred category, bias toward it (70% from preferred, 30% random)
        if (preferredCat) {
            const fromCat = sorted.filter((p) =>
                (p as { category?: string }).category === preferredCat
            );
            const others = sorted.filter((p) =>
                (p as { category?: string }).category !== preferredCat
            );
            // Take 7 from preferred category, 3 from others, then shuffle
            const selected = [...fromCat.slice(0, 7), ...shuffle(others).slice(0, 3)];
            return shuffle(selected).slice(0, 10);
        }

        // No preference: take top 15 by sold, shuffle, pick 10
        return shuffle(sorted.slice(0, 15)).slice(0, 10);
    }, [data, preferredCat]);

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
                    <p className="mt-1 text-sm text-muted">
                        {preferredCat
                            ? "Rekomendasi berdasarkan minat Anda"
                            : "Produk paling banyak diminati pembeli"}
                    </p>
                </div>
                <Link
                    href="/produk"
                    className="whitespace-nowrap text-sm font-semibold text-brand hover:underline"
                >
                    Lihat Semua →
                </Link>
            </div>

            {preferredCat && (
                <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-brand/5 px-3 py-1.5 text-xs text-brand">
                    <Sparkles className="h-3.5 w-3.5" />
                    Menampilkan rekomendasi berdasarkan kategori yang Anda minati
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {products.map((p) => (
                    <ProductCard key={p.id} p={p} />
                ))}
            </div>
        </section>
    );
}