"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Coffee,
  CookingPot,
  Fish,
  Flashlight,
  Gift,
  Home,
  Mic,
  Tent,
  type LucideIcon,
} from "lucide-react";
import { heroSlides, type IconKey } from "@/lib/data";
import { marketplaces, marketplaceLink, whatsappLink } from "@/lib/config";

const HERO_ICONS: Partial<Record<IconKey, LucideIcon>> = {
  home: Home,
  cooking: CookingPot,
  flashlight: Flashlight,
  fish: Fish,
  tent: Tent,
  coffee: Coffee,
  mic: Mic,
  gift: Gift,
};

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const total = heroSlides.length;

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % total), 5000);
    return () => clearInterval(t);
  }, [total]);

  const go = (i: number) => setIndex((i + total) % total);
  const slide = heroSlides[index];
  const SlideIcon = HERO_ICONS[slide.icon] ?? Home;

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-brand to-[#c41f05] text-white shadow-lg">
      {/* Slide background image */}
      <div key={slide.image} className="absolute inset-0 animate-fade-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slide.image} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        {/* Overlay untuk keterbacaan teks */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#4a0e02]/90 via-[#7a1a05]/70 to-[#a32004]/55" />
      </div>

      {/* Decorative shapes */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-24 right-24 h-72 w-72 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-white/5 blur-2xl" />

      <div className="relative flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center sm:min-h-[360px] sm:px-12">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold tracking-wide backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
          Belanja Online Mudah &amp; Aman
        </span>

        <span key={slide.icon} className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 backdrop-blur animate-fade-in-up">
          <SlideIcon className="h-11 w-11" />
        </span>

        <h2 key={`t-${index}`} className="mt-5 max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl animate-fade-in-up">
          {slide.title}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">{slide.subtitle}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/produk"
            className="rounded-xl bg-black px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-gray-900"
          >
            Belanja Sekarang
          </Link>
          <Link
            href="/produk"
            className="rounded-xl border border-white/40 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
          >
            Lihat Kategori
          </Link>
        </div>

        {/* Marketplace strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-white/70">Pesan melalui:</span>
          <a
            href={whatsappLink("Halo KTD Store, saya ingin bertanya tentang produk Anda.")}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold backdrop-blur transition-colors hover:bg-black/35"
          >
            WhatsApp
          </a>
          {marketplaces.map((m) => (
            <a
              key={m.key}
              href={marketplaceLink(m, slide.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold backdrop-blur transition-colors hover:bg-black/35"
            >
              {m.label}
            </a>
          ))}
        </div>
      </div>

      {/* Arrows */}
      <button
        onClick={() => go(index - 1)}
        aria-label="Slide sebelumnya"
        className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur transition-colors hover:bg-black/35 sm:flex"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={() => go(index + 1)}
        aria-label="Slide berikutnya"
        className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur transition-colors hover:bg-black/35 sm:flex"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
        {heroSlides.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/70"}`}
          />
        ))}
      </div>
    </div>
  );
}
