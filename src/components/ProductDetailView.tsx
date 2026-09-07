"use client";

import { useState } from "react";
import Link from "next/link";
import { Boxes, MessageCircle, Package, ShieldCheck, ShoppingBag, Tag } from "lucide-react";
import { marketplaces } from "@/lib/config";
import { sanitizeHtml } from "@/lib/sanitize";
import MarketplaceIcon from "@/components/MarketplaceIcon";
import MarketplaceNotice from "@/components/MarketplaceNotice";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import WhatsAppOrderModal from "@/components/WhatsAppOrderModal";
import RelatedProducts from "@/components/RelatedProducts";
import type { AnekaProductDetail } from "@/lib/anekadropship";

export default function ProductDetailView({ detail }: { detail: AnekaProductDetail }) {
  const [activeImg, setActiveImg] = useState(0);
  const [waOpen, setWaOpen] = useState(false);
  // Marketplace whose link was clicked but the product isn't uploaded there yet.
  const [missingMp, setMissingMp] = useState<string | null>(null);

  const images = detail.images.length ? detail.images : ["/placeholder.svg"];
  const active = images[Math.min(activeImg, images.length - 1)];
  const price = detail.rekomendasiJual || "Rp -";

  return (
    <div className="container-site py-5 pb-24 lg:pb-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <Link href="/produk" className="transition-colors hover:text-brand">Produk</Link>
        <span>/</span>
        <span className="truncate text-muted">{detail.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div className="min-w-0 lg:sticky lg:top-32 lg:self-start">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active}
              alt={detail.name}
              className="absolute inset-0 h-full w-full object-contain p-4"
            />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {images.map((img, i) => (
                <button
                  key={img + i}
                  onClick={() => setActiveImg(i)}
                  className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${i === activeImg ? "border-brand ring-1 ring-brand/30" : "border-gray-100 hover:border-gray-300"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-snug text-ink sm:text-2xl">{detail.name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-2">
            {detail.terjual && (
              <span className="inline-flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-brand" />
                <b className="text-ink">{detail.terjual}</b> terjual
              </span>
            )}
            {detail.stok && (
              <span className="inline-flex items-center gap-1.5">
                <Boxes className="h-4 w-4 text-brand" />
                Stok <b className="text-ink">{detail.stok}</b>
              </span>
            )}
          </div>

          {/* Price card */}
          <div className="mt-5 rounded-2xl border border-brand/15 bg-brand/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
              Harga
            </p>
            <p className="mt-1 text-3xl font-extrabold text-brand sm:text-4xl">
              {price}
            </p>
          </div>

          {/* WhatsApp order */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setWaOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#1eb85a]"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Pesan via WhatsApp
            </button>
            <p className="mt-2 text-xs text-muted-2">
              Isi alamat penerima, pesanan langsung terkirim ke WhatsApp kami.
            </p>
          </div>

          {/* Order via marketplace */}
          <div className="mt-6">
            <p className="mb-3 text-sm font-bold text-ink">Beli di marketplace resmi:</p>
            {missingMp && (
              <MarketplaceNotice
                label={missingMp}
                onClose={() => setMissingMp(null)}
                className="mb-3"
              />
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              {marketplaces.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMissingMp(m.label)}
                  aria-label={`Beli via ${m.label}`}
                  className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:opacity-90"
                  style={{ backgroundColor: m.color }}
                >
                  <MarketplaceIcon name={m.key} variant="white" className="h-4 w-auto object-contain" />
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-2">
              <ShieldCheck className="h-4 w-4 text-brand" />
              Untuk saat ini pemesanan dilayani melalui WhatsApp.
            </p>
          </div>

          {/* Trust badges */}
          <div className="mt-6 grid grid-cols-1 gap-2 border-t border-gray-100 pt-5 sm:grid-cols-3 sm:text-center">
            {[
              { icon: Tag, label: "Harga Bersaing" },
              { icon: Package, label: "Info Stok Tercantum" },
              { icon: MessageCircle, label: "CS via WhatsApp" },
            ].map((t) => (
              <div
                key={t.label}
                className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5 sm:flex-col sm:gap-1 sm:px-2 sm:py-3"
              >
                <t.icon className="h-5 w-5 shrink-0 text-brand sm:mx-auto" />
                <p className="text-xs font-medium text-muted sm:mt-1">{t.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      {detail.descriptionHtml && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold text-ink sm:text-2xl">Deskripsi Produk</h2>
          <div
            className="deskripsi-produk rounded-2xl border border-gray-100 bg-white p-5 text-sm leading-6 shadow-sm sm:p-7"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(detail.descriptionHtml) }}
          />
        </section>
      )}

      {/* Related products */}
      <RelatedProducts productId={detail.id} productName={detail.name} />

      {/* Sticky mobile order bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 p-2.5 backdrop-blur lg:hidden">
        {missingMp && (
          <div className="mx-auto mb-2 max-w-2xl">
            <MarketplaceNotice label={missingMp} onClose={() => setMissingMp(null)} />
          </div>
        )}
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <div className="shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-2">Harga</p>
            <p className="max-w-28 truncate text-base font-extrabold text-brand">{price}</p>
          </div>
          <div className="ml-auto flex min-w-0 flex-1 max-w-sm items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setWaOpen(true)}
              aria-label="Pesan via WhatsApp"
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <WhatsAppIcon className="h-5 w-5" />
              WA
            </button>
            {marketplaces.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMissingMp(m.label)}
                aria-label={`Pesan via ${m.label}`}
                className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl px-1 text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: m.color }}
              >
                <MarketplaceIcon name={m.key} variant="white" className="h-3.5 w-auto max-w-full object-contain" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <WhatsAppOrderModal
        open={waOpen}
        onClose={() => setWaOpen(false)}
        productName={detail.name}
        price={price}
      />
    </div>
  );
}
