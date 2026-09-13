"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { heroSlides } from "@/lib/data";
import { marketplaces, marketplaceLink, whatsappLink } from "@/lib/config";

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const total = heroSlides.length;

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % total), 5000);
    return () => clearInterval(t);
  }, [total]);

  const go = (i: number) => setIndex((i + total) % total);
  const slide = heroSlides[index];

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-brand to-[#c41f05] text-white shadow-lg">
      {/* Slide background image */}
      <div key={slide.image} className="absolute inset-0 animate-fade-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slide.image} alt="" aria-hidden="true" className="h-full w-full object-cover sm:object-contain" />
        {/* Overlay untuk keterbacaan teks */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#4a0e02]/90 via-[#7a1a05]/70 to-[#a32004]/55" />
      </div>

      {/* Decorative shapes */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-24 right-24 h-72 w-72 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-white/5 blur-2xl" />

      <div className="relative flex aspect-[4/3] min-h-[320px] flex-col items-center justify-end px-6 pb-12 pt-12 text-center sm:aspect-[21/9] sm:min-h-[360px] sm:pr-16">
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

      {/* Dots — horizontal bottom on mobile, vertical right on desktop */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 sm:bottom-auto sm:left-auto sm:right-4 sm:top-1/2 sm:-translate-y-1/2 sm:-translate-x-0 sm:flex-col">
        {heroSlides.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1}`}
            className={`rounded-full transition-all ${i === index
                ? "bg-white"
                : "bg-white/50 hover:bg-white/70"
              } h-2 w-2 sm:h-2 sm:w-2 ${i === index ? "w-6 sm:w-2 sm:h-6" : ""
              }`}
          />
        ))}
      </div>
    </div>
  );
}
