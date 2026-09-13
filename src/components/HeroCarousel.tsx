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
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-brand to-[#c41f05] text-white shadow-lg">
      {/* Image area — fixed aspect ratio for smooth transitions */}
      <div className="group relative aspect-[4/3] sm:aspect-[21/9]">
        <div key={slide.image} className="absolute inset-0 animate-fade-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.image}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain"
          />
        </div>

        {/* Arrows — hidden on mobile */}
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

        {/* Dots — on image, bottom-center mobile, right-center desktop */}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 sm:bottom-auto sm:left-auto sm:right-4 sm:top-1/2 sm:-translate-y-1/2 sm:-translate-x-0 sm:flex-col">
          {heroSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`Slide ${i + 1}`}
              className={`rounded-full transition-all ${i === index ? "bg-white" : "bg-white/50 hover:bg-white/70"
                } h-2 w-2 sm:h-2 sm:w-2 ${i === index ? "w-6 sm:w-2 sm:h-6" : ""
                }`}
            />
          ))}
        </div>

        {/* Desktop: buttons overlaid on image */}
        <div className="absolute bottom-0 left-0 right-0 hidden flex-col items-center px-6 pb-4 sm:flex">
          <div className="flex flex-wrap items-center justify-center gap-3">
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

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
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
      </div>

      {/* Mobile: buttons + marketplace below image (separate section) */}
      <div className="flex flex-col items-center gap-3 px-4 py-4 sm:hidden">
        <div className="flex items-center justify-center gap-2">
          <Link
            href="/produk"
            className="rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-gray-900 sm:text-sm sm:px-5"
          >
            Belanja Sekarang
          </Link>
          <Link
            href="/produk"
            className="rounded-xl border border-white/40 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-white/10 sm:text-sm sm:px-5"
          >
            Lihat Kategori
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5">
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
    </div>
  );
}
