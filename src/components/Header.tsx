"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  LayoutGrid,
  Menu,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { WHATSAPP_NUMBER } from "@/lib/config";
import { useApi } from "@/lib/useApi";
import { useCart } from "@/lib/cart";
import CategoryIcon from "@/components/CategoryIcon";
import SearchBox from "@/components/SearchBox";
import type { AnekaCategory } from "@/lib/anekadropship";

export default function Header() {
  const [megaOpen, setMegaOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { items, count, removeItem } = useCart();

  const { data } = useApi<{ categories: AnekaCategory[] }>("/api/categories");
  const categories = data?.categories ?? [];

  const closeAll = () => {
    setMegaOpen(false);
    setCartOpen(false);
    setMobileOpen(false);
  };

  // Close menus on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMegaOpen(false);
        setCartOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 shadow-sm">
      {/* Band 1 — top utility bar */}
      <div className="bg-brand text-white">
        <div className="container-site flex items-center justify-between py-1.5 text-xs">
          <div className="hidden items-center gap-4 md:flex">
            <Link href="/produk" className="transition-colors hover:underline">Semua Produk</Link>
            <Link href="/cara-belanja" className="transition-colors hover:underline">Cara Belanja</Link>
            <Link href="/konfirmasi-pembayaran" className="transition-colors hover:underline">Konfirmasi Pembayaran</Link>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            className="flex items-center gap-1.5 font-medium transition-colors hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 ring-2 ring-emerald-300/40" />
            Customer Service (WhatsApp)
          </a>
        </div>
      </div>

      {/* Band 2 — main row */}
      <div className="bg-brand text-white">
        <div className="container-site flex items-center gap-2 py-3 sm:gap-3">
          {/* Hamburger (mobile) */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-white/10 md:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.png"
              alt="KTD Store"
              className="h-9 w-9 rounded-xl bg-white object-contain shadow-md"
            />
            <span className="whitespace-nowrap text-xl font-extrabold tracking-tight">
              KTD Store
            </span>
          </Link>

          {/* Search (desktop) */}
          <SearchBox variant="desktop" onNavigate={closeAll} />

          {/* Cart */}
          <div
            className="relative"
            onMouseEnter={() => setCartOpen(true)}
            onMouseLeave={() => setCartOpen(false)}
          >
            <Link
              href="/keranjang"
              className="relative flex items-center gap-1.5 rounded-lg px-2 py-2 transition-colors hover:bg-white/10 sm:px-3"
            >
              <ShoppingCart className="h-[22px] w-[22px]" />
              <span className="hidden lg:inline">Keranjang</span>
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-brand shadow">
                  {count}
                </span>
              )}
            </Link>
            {cartOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-xl bg-white text-ink shadow-xl ring-1 ring-black/5">
                {count === 0 ? (
                  <div className="p-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-brand">
                      <ShoppingCart className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-sm font-semibold">Keranjang Anda masih kosong</p>
                    <Link
                      href="/produk"
                      className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2"
                    >
                      Mulai Belanja
                    </Link>
                  </div>
                ) : (
                  <div className="p-3">
                    <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-2">
                      Keranjang ({count} produk)
                    </p>
                    <ul className="max-h-72 space-y-1 overflow-y-auto thin-scroll">
                      {items.map((i) => (
                        <li
                          key={i.id}
                          className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-gray-50"
                        >
                          <Link href={`/produk/${i.id}`} className="shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={i.image}
                              alt={i.name}
                              className="h-11 w-11 rounded-lg border border-gray-100 object-cover"
                            />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/produk/${i.id}`}
                              className="block truncate text-xs font-medium text-ink transition-colors hover:text-brand"
                            >
                              {i.name}
                            </Link>
                            <p className="mt-0.5 text-xs text-brand">{i.price}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(i.id)}
                            aria-label={`Hapus ${i.name}`}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-2 transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/keranjang"
                      className="mt-2 block rounded-lg bg-brand py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-2"
                    >
                      Lihat Keranjang
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>


        </div>

        {/* Search (mobile) */}
        <div className="container-site pb-3 md:hidden">
          <SearchBox variant="mobile" onNavigate={closeAll} />
        </div>
      </div>

      {/* Band 3 — category nav (desktop) */}
      <div className="hidden bg-white text-ink shadow-sm md:block">
        <div className="container-site flex items-center gap-1 py-2 text-sm">
          {/* Kategori mega menu */}
          <div
            className="relative shrink-0"
            onMouseEnter={() => setMegaOpen(true)}
            onMouseLeave={() => setMegaOpen(false)}
          >
            <button className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand px-4 py-2 font-semibold text-white transition-colors hover:bg-brand-2">
              <Menu className="h-4 w-4" />
              Kategori
              <ChevronDown className="h-4 w-4" />
            </button>
            {megaOpen && (
              <div className="absolute left-0 top-full z-30 w-[560px] max-w-[90vw] rounded-b-2xl bg-white text-ink shadow-2xl ring-1 ring-black/5 animate-fade-in">
                <div className="grid max-h-[70vh] grid-cols-2 gap-1 overflow-y-auto p-3 thin-scroll">
                  {categories.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/produk?category=${encodeURIComponent(c.slug)}`}
                      className="flex items-center gap-2.5 truncate rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-brand/5 hover:text-brand"
                    >
                      <CategoryIcon slug={c.slug} className="h-4 w-4 shrink-0 text-brand" />
                      <span className="truncate">{c.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link
            href="/produk"
            className="whitespace-nowrap px-3 py-2 font-semibold text-ink transition-colors hover:text-brand"
          >
            Semua Produk
          </Link>

          <span className="h-4 w-px bg-gray-200" />

          <nav className="flex flex-1 items-center gap-0.5 overflow-hidden">
            {categories.slice(0, 7).map((c) => (
              <Link
                key={c.slug}
                href={`/produk?category=${encodeURIComponent(c.slug)}`}
                className="whitespace-nowrap px-2.5 py-2 text-muted transition-colors hover:text-brand"
              >
                {c.name}
              </Link>
            ))}
          </nav>

          <Link
            href="/produk"
            className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap px-2 py-2 font-semibold text-brand transition-colors hover:underline"
          >
            Lihat Semua
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-80 max-w-[85vw] flex-col bg-white shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <span className="flex items-center gap-2 font-bold">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
                  <Menu className="h-4 w-4" />
                </span>
                Kategori
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Tutup menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 thin-scroll">
              <Link
                href="/produk"
                onClick={() => setMobileOpen(false)}
                className="mb-1 flex items-center gap-3 rounded-lg bg-brand/5 px-3 py-2.5 text-sm font-semibold text-brand"
              >
                <LayoutGrid className="h-5 w-5" />
                Semua Produk
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/produk?category=${encodeURIComponent(c.slug)}`}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink transition-colors hover:bg-gray-50"
                >
                  <CategoryIcon slug={c.slug} className="h-5 w-5 shrink-0 text-brand" />
                  <span className="truncate">{c.name}</span>
                </Link>
              ))}
            </div>
            <div className="border-t border-gray-100 p-4">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/cara-belanja"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-semibold text-ink transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                >
                  Cara Belanja
                </Link>
                <Link
                  href="/konfirmasi-pembayaran"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-semibold text-ink transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                >
                  Konfirmasi Pembayaran
                </Link>
              </div>
              <p className="mt-3 text-center text-xs text-muted">
                Butuh bantuan?{" "}
                <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand">
                  WhatsApp CS
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
