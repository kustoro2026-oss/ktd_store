"use client";

// Grup tombol melayang pojok kanan bawah: "kembali ke atas" (biru) di atas
// tombol chat WhatsApp (hijau) dengan titik notifikasi merah. Tombol ke atas
// hanya muncul setelah halaman di-scroll. Di mobile, posisinya dinaikkan
// (bottom-20) agar tidak menutupi bar aksi bawah halaman produk/top up.

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { whatsappLink } from "@/lib/config";

export default function FloatingActions() {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-center gap-3 lg:bottom-6">
      {/* Kembali ke atas */}
      <button
        type="button"
        aria-label="Kembali ke atas"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#0D6EFD] to-[#17A2B8] text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-105 active:scale-95 ${
          showTop
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
      </button>

      {/* Chat WhatsApp — gelombang sonar + titik notifikasi */}
      <a
        href={whatsappLink("Halo, saya mau bertanya tentang produk di KTD Store.")}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat WhatsApp KTD Store"
        style={{ color: "#FFFFFF" }}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg shadow-[#25D366]/40 transition-transform duration-300 hover:scale-105 active:scale-95"
      >
        {/* Cincin gelombang (sonar) — memuai & memudar bergantian */}
        <span
          aria-hidden="true"
          className="animate-wa-wave pointer-events-none absolute inset-0 rounded-full bg-[#25D366]/70"
        />
        <span
          aria-hidden="true"
          className="animate-wa-wave pointer-events-none absolute inset-0 rounded-full bg-[#25D366]/50"
          style={{ animationDelay: "0.8s" }}
        />
        <span
          aria-hidden="true"
          className="animate-wa-wave pointer-events-none absolute inset-0 rounded-full bg-[#25D366]/40"
          style={{ animationDelay: "1.6s" }}
        />
        <WhatsAppIcon className="relative h-7 w-7" />
        {/* Titik notifikasi */}
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-red-500" />
        </span>
      </a>
    </div>
  );
}
