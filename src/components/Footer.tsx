"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { marketplaces, WHATSAPP_NUMBER, whatsappDisplay } from "@/lib/config";
import MarketplaceIcon from "@/components/MarketplaceIcon";
import MarketplaceNotice from "@/components/MarketplaceNotice";

const payments = [
  { name: "BCA", src: "/images/footer/bca.png" },
  { name: "Mandiri", src: "/images/footer/mandiri.png" },
  { name: "BNI", src: "/images/footer/bni.png" },
  { name: "BRI", src: "/images/footer/bri.png" },
  { name: "CIMB", src: "/images/footer/cimb.png" },
  { name: "OCTO Clicks", src: "/images/footer/cimb-clicks.png" },
  { name: "QRIS", src: "/images/footer/qris.png" },
  { name: "KlikBCA", src: "/images/footer/klikbca.png" },
  { name: "Visa", src: "/images/footer/visa.png" },
  { name: "Master Card", src: "/images/footer/mastercard.png" },
  { name: "JCB", src: "/images/footer/jcb.png" },
  { name: "American Express", src: "/images/footer/amex.png" },
  { name: "BRImo", src: "/images/footer/brimo.png" },
  { name: "OVO", src: "/images/footer/ovo.png" },
  { name: "ShopeePay", src: "/images/footer/shopee_pay.png" },
  { name: "BTN", src: "/images/footer/btn.png" },
  { name: "BNI iPay", src: "/images/footer/bni-i-pay.png" },
  { name: "Indomaret", src: "/images/footer/indomaret.png" },
  { name: "Kredivo", src: "/images/footer/kredivo.png" },
];

const shippings = [
  { name: "JNE", src: "/images/footer/jne.png" },
  { name: "Si Cepat", src: "/images/footer/sicepat.png" },
  { name: "GO-SEND", src: "/images/footer/go-send.png" },
  { name: "J&T Express", src: "/images/footer/j-t.png" },
  { name: "Grab Express", src: "/images/footer/grab-express.png" },
  { name: "Shopee Xpress", src: "/images/footer/shopee-xpress.png" },
];

export default function Footer() {
  // Marketplace whose store link was clicked but the store isn't there yet.
  const [missingMp, setMissingMp] = useState<string | null>(null);

  return (
    <footer className="mt-14 border-t border-gray-100 bg-white">
      {/* Link Lainnya */}
      <div className="container-site flex flex-wrap items-center gap-x-6 gap-y-2 py-4 text-sm text-muted">
        <span className="font-semibold text-ink">Link Lainnya:</span>
        <Link href="/tentang-kami" className="transition-colors hover:text-brand">Tentang Kami</Link>
        <Link href="/karir" className="transition-colors hover:text-brand">Karir</Link>
        <Link href="/tips" className="transition-colors hover:text-brand">Blog</Link>
        <Link href="/bantuan" className="transition-colors hover:text-brand">Bantuan</Link>
        <Link href="/syarat-ketentuan" className="transition-colors hover:text-brand">Syarat &amp; Ketentuan</Link>
      </div>

      <div className="bg-gray-50/70">
        <div className="container-site grid gap-8 py-10 md:grid-cols-3">
          {/* Brand + newsletter */}
          <div>
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logo.png"
                alt="KTD Store"
                className="h-9 w-9 rounded-xl bg-brand object-contain"
              />
              <span className="text-xl font-extrabold tracking-tight text-ink">
                KTD Store
              </span>
            </Link>
            <p className="mt-3 text-sm leading-6 text-muted">
              Toko online terpercaya untuk kebutuhan rumah tangga, kecantikan,
              dan gaya hidup. Belanja mudah dengan harga terbaik.
            </p>
          </div>

          {/* Customer service */}
          <div>
            <h3 className="text-base font-bold text-ink">Layanan Pelanggan</h3>
            <p className="mt-3 text-sm text-muted">
              Setiap hari 09:00 – 18:00 WIB
              <br />
              (kecuali hari libur nasional)
            </p>
            <p className="mt-3 text-sm">
              <span className="text-muted">Email: </span>
              <a href="mailto:support@ktdstore.com" className="font-medium transition-colors hover:text-brand">
                support@ktdstore.com
              </a>
            </p>
            <p className="mt-1.5 text-sm">
              <span className="text-muted">WhatsApp: </span>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="font-medium transition-colors hover:text-brand" target="_blank" rel="noopener noreferrer">
                {whatsappDisplay()}
              </a>
            </p>
          </div>

          {/* Marketplace */}
          <div>
            <h3 className="text-base font-bold text-ink">Belanja di Marketplace</h3>
            <p className="mt-3 text-sm text-muted">
              Pesan melalui WhatsApp — marketplace resmi segera menyusul.
            </p>
            {missingMp && (
              <div className="mt-3">
                <MarketplaceNotice
                  label={missingMp}
                  onClose={() => setMissingMp(null)}
                  message={
                    <>
                      Toko KTD Store belum tersedia di <b>{missingMp}</b>. Silakan
                      pesan melalui WhatsApp untuk saat ini.
                    </>
                  }
                />
              </div>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {marketplaces.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMissingMp(m.label)}
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold shadow-sm ring-1 ring-gray-200 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="flex h-9 w-20 shrink-0 items-center justify-center">
                    <MarketplaceIcon name={m.key} className="h-5 w-auto max-w-full object-contain" />
                  </span>
                  <span className="text-ink">{m.label}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-2" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Payments & shipping */}
        <div className="container-site border-t border-gray-200 py-6">
          <h4 className="mb-3 text-sm font-semibold text-ink">Metode Pembayaran</h4>
          <div className="flex flex-wrap gap-2">
            {payments.map((p) => (
              <span
                key={p.name}
                title={p.name}
                className="flex h-10 w-16 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white p-1.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt={p.name}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain"
                />
              </span>
            ))}
          </div>
          <h4 className="mb-3 mt-6 text-sm font-semibold text-ink">Metode Pengiriman</h4>
          <div className="flex flex-wrap gap-2">
            {shippings.map((s) => (
              <span
                key={s.name}
                title={s.name}
                className="flex h-10 w-16 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white p-1.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.src}
                  alt={s.name}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain"
                />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="container-site flex flex-col items-center justify-between gap-2 py-4 text-xs text-muted sm:flex-row">
        <p>© 2026 KTD Store. All rights reserved.</p>
        <p>Belanja mudah, transaksi aman.</p>
      </div>
    </footer>
  );
}
