"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bolt, ChevronLeft, ChevronRight, ShoppingCart, Check, Clock } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { useCart } from "@/lib/cart";
import {
    isFlashSaleProduct,
    hitungFlashSale,
    parseStock,
    getFlashSaleStatus,
    secondsUntilFlashSaleEnds,
    FLASH_SALE_MAX_ITEMS,
    FLASH_SALE_SCHEDULE,
} from "@/lib/promo";
import type { AnekaProduct } from "@/lib/anekadropship";

/** Format detik ke HH:MM:SS. */
function formatCountdown(seconds: number): string {
    if (seconds <= 0) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Format jam dari Date WIB, e.g. "09:00". */
function formatHour(date: Date): string {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
}

/** Deskripsi jadwal Flash Sale, e.g. "09:00 - 12:00 & 19:00 - 23:00". */
function formatSchedule(): string {
    return FLASH_SALE_SCHEDULE.map(
        ([s, e]) => `${String(s).padStart(2, "0")}:00 - ${String(e).padStart(2, "0")}:00`
    ).join(" & ");
}

/** Skeleton untuk card flash sale. */
function FlashCardSkeleton() {
    return (
        <div className="flex w-[180px] shrink-0 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm sm:w-[200px]">
            <div className="aspect-square animate-pulse bg-gray-100" />
            <div className="space-y-2 p-3">
                <div className="h-3 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
            </div>
        </div>
    );
}

/** Satu card produk Flash Sale. */
function FlashSaleCard({ p }: { p: AnekaProduct }) {
    const { hasItem, toggleItem } = useCart();
    const inCart = hasItem(p.id);
    const flash = hitungFlashSale(p.rekomendasiJual);
    const stock = parseStock(p.stok);
    const price = p.rekomendasiJual || "Rp -";

    return (
        <div className="group flex w-[180px] shrink-0 flex-col overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md sm:w-[200px]">
            {/* Image */}
            <Link
                href={`/produk/${p.id}`}
                className="relative block aspect-square w-full overflow-hidden bg-gray-50"
            >
                <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    sizes="200px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Flash Sale badge */}
                {flash && (
                    <span className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        -{flash.persen}%
                    </span>
                )}
                {/* Stok tipis */}
                {stock > 0 && stock <= 10 && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                        Sisa {stock}
                    </span>
                )}
            </Link>

            <div className="flex flex-1 flex-col p-2.5">
                {/* Name */}
                <Link
                    href={`/produk/${p.id}`}
                    title={p.name}
                    className="line-clamp-2 text-xs font-medium leading-snug text-ink transition-colors hover:text-brand"
                >
                    {p.name}
                </Link>

                {/* Price */}
                <div className="mt-1.5">
                    {flash ? (
                        <div className="space-y-0.5">
                            <span className="text-base font-extrabold text-red-600 sm:text-lg">
                                {flash.flashPrice}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-muted-2 line-through">
                                    {flash.coret}
                                </span>
                                <span className="text-[10px] font-semibold text-green-600">
                                    Hemat {flash.hemat}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-base font-bold text-brand">{price}</div>
                    )}
                </div>

                {/* Sold + stock bar */}
                <div className="mt-1.5">
                    <div className="flex items-center justify-between text-[10px] text-muted-2">
                        <span>{p.terjual || "0"} terjual</span>
                        <span>Stok {stock}</span>
                    </div>
                    {/* Progress bar stok */}
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all"
                            style={{
                                width: `${Math.min(100, Math.max(0, 100 - (stock / 50) * 100))}%`,
                            }}
                        />
                    </div>
                </div>

                {/* CTA */}
                <div className="mt-auto flex gap-1.5 pt-2.5">
                    <button
                        type="button"
                        onClick={() =>
                            toggleItem({ id: p.id, name: p.name, image: p.image, price })
                        }
                        aria-label={inCart ? "Hapus dari Keranjang" : "Masukkan Keranjang"}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${inCart
                            ? "border-brand bg-brand text-white"
                            : "border-gray-200 text-ink hover:border-brand hover:text-brand"
                            }`}
                    >
                        {inCart ? (
                            <Check className="h-3.5 w-3.5" />
                        ) : (
                            <ShoppingCart className="h-3.5 w-3.5" />
                        )}
                    </button>
                    <Link
                        href={`/produk/${p.id}`}
                        className="flex flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-red-500 to-orange-500 px-2 py-1.5 text-xs font-semibold text-white transition-all hover:from-red-600 hover:to-orange-600"
                    >
                        Beli
                    </Link>
                </div>
            </div>
        </div>
    );
}

type Props = {
    initialProducts?: AnekaProduct[] | null;
};

export default function FlashSale({ initialProducts }: Props) {
    const { data, loading } = useApi<{ products: AnekaProduct[] }>(
        initialProducts ? null : "/api/products?sort=newest&page=1",
    );
    const products = initialProducts ?? data?.products ?? [];

    // Filter produk yang layak Flash Sale (dengan safety check profit)
    const flashProducts = useMemo(() => {
        return products
            .filter((p) => isFlashSaleProduct(p.rekomendasiJual, p.stok, p.hargaModal))
            .slice(0, FLASH_SALE_MAX_ITEMS);
    }, [products]);

    // ─── Schedule-aware state ───────────────────────────────────────────
    // Initialised with a neutral value so server & client render identically.
    // The real schedule is computed inside useEffect (client-only).
    const [schedule, setSchedule] = useState<ReturnType<typeof getFlashSaleStatus>>(() => ({
        active: false,
        endTime: new Date(),
        nextStart: null,
    }));
    const [remaining, setRemaining] = useState(0);

    useEffect(() => {
        const tick = () => {
            const status = getFlashSaleStatus();
            setSchedule(status);
            setRemaining(status.active ? secondsUntilFlashSaleEnds() : 0);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    // ─── Horizontal scroll ──────────────────────────────────────────────
    const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScroll = useCallback((el: HTMLDivElement) => {
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, []);

    const scrollBy = (dir: "left" | "right") => {
        if (!scrollEl) return;
        const amount = dir === "left" ? -300 : 300;
        scrollEl.scrollBy({ left: amount, behavior: "smooth" });
    };

    // ─── Render ─────────────────────────────────────────────────────────

    // Jangan render jika tidak ada produk flash sale
    if (!loading && flashProducts.length === 0) return null;

    // Di luar jam operasional: tampilkan banner "akan dimulai" (opsional — bisa juga return null)
    if (!schedule.active) {
        const nextTime = schedule.nextStart ? formatHour(schedule.nextStart) : null;
        return (
            <section className="container-site mt-10">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-700 via-gray-600 to-gray-500 p-5 text-white shadow-lg sm:p-6">
                    <div
                        className="pointer-events-none absolute inset-0 opacity-5"
                        style={{
                            backgroundImage:
                                "radial-gradient(circle, #fff 1px, transparent 1px)",
                            backgroundSize: "20px 20px",
                        }}
                    />
                    <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
                                <Clock className="h-6 w-6 text-gray-300" />
                            </span>
                            <div>
                                <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                                    ⚡ Flash Sale
                                </h2>
                                <p className="mt-0.5 text-sm text-white/70">
                                    {nextTime
                                        ? `Dimulai pukul ${nextTime} WIB — jam operasional: ${formatSchedule()} WIB`
                                        : `Jam operasional: ${formatSchedule()} WIB`}
                                </p>
                            </div>
                        </div>
                        {nextTime && (
                            <div className="flex items-center gap-2 self-start rounded-xl bg-black/20 px-4 py-2 backdrop-blur sm:self-auto">
                                <span className="text-xs font-semibold text-white/70">
                                    Dimulai pukul
                                </span>
                                <span className="text-xl font-bold tabular-nums tracking-wider sm:text-2xl">
                                    {nextTime}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="container-site mt-10">
            {/* Header dengan background gradien */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 p-5 text-white shadow-lg sm:p-6">
                {/* Decorative dots */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-10"
                    style={{
                        backgroundImage:
                            "radial-gradient(circle, #fff 1px, transparent 1px)",
                        backgroundSize: "20px 20px",
                    }}
                />

                <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                            <Bolt className="h-6 w-6 text-yellow-300" />
                        </span>
                        <div>
                            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                                ⚡ Flash Sale
                            </h2>
                            <p className="mt-0.5 text-sm text-white/80">
                                Diskon {FLASH_SALE_MAX_ITEMS > 0 ? "besar" : ""} produk stok
                                terbatas — buruan sebelum kehabisan!
                            </p>
                        </div>
                    </div>

                    {/* Countdown */}
                    <div className="flex items-center gap-2 self-start rounded-xl bg-black/20 px-4 py-2 backdrop-blur sm:self-auto">
                        <span className="text-xs font-semibold text-white/70">
                            Berakhir dalam
                        </span>
                        <span className="text-xl font-bold tabular-nums tracking-wider sm:text-2xl">
                            {formatCountdown(remaining)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Product row */}
            <div className="relative mt-4">
                {/* Scroll left button */}
                {canScrollLeft && (
                    <button
                        type="button"
                        onClick={() => scrollBy("left")}
                        aria-label="Scroll kiri"
                        className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 text-ink shadow-md transition-all hover:border-brand hover:text-brand sm:flex"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                )}

                {/* Scroll right button */}
                {canScrollRight && (
                    <button
                        type="button"
                        onClick={() => scrollBy("right")}
                        aria-label="Scroll kanan"
                        className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 text-ink shadow-md transition-all hover:border-brand hover:text-brand sm:flex"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                )}

                {loading ? (
                    <div className="flex gap-3 overflow-hidden pb-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <FlashCardSkeleton key={i} />
                        ))}
                    </div>
                ) : (
                    <div
                        ref={(el) => {
                            setScrollEl(el);
                            if (el) updateScroll(el);
                        }}
                        onScroll={(e) => updateScroll(e.currentTarget)}
                        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
                    >
                        {flashProducts.map((p) => (
                            <div key={p.id} className="snap-start">
                                <FlashSaleCard p={p} />
                            </div>
                        ))}
                        {/* Link ke semua produk */}
                        <Link
                            href="/produk"
                            className="flex w-[180px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 text-center transition-all hover:border-brand/40 hover:bg-brand/5 sm:w-[200px]"
                        >
                            <span className="text-3xl">🛍️</span>
                            <span className="text-sm font-semibold text-muted">
                                Lihat Semua Produk
                            </span>
                            <span className="text-xs text-brand">Belanja Sekarang →</span>
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}