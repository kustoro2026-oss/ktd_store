"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Trash2 } from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart";
import { marketplaces } from "@/lib/config";
import { getTikTokProductLink } from "@/lib/tiktok-product-links";
import MarketplaceIcon from "@/components/MarketplaceIcon";
import MarketplaceNotice from "@/components/MarketplaceNotice";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import WhatsAppOrderModal from "@/components/WhatsAppOrderModal";

const formatRupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);

/** "Rp 25.000" -> 25000 */
const parseRupiah = (s: string) => {
  const d = s.replace(/\D/g, "");
  return d ? Number(d) : 0;
};

export default function CartPage() {
  const { items, count, removeItem, clear } = useCart();
  const [waSingle, setWaSingle] = useState<CartItem | null>(null);
  const [waCart, setWaCart] = useState(false);
  // Marketplace whose "Beli via" button was clicked but the product isn't there yet.
  const [missingMp, setMissingMp] = useState<string | null>(null);
  const total = items.reduce((s, it) => s + parseRupiah(it.price), 0);

  /** Buka link marketplace; khusus TikTok Shop pakai link produk dari tokopedia-products.json. */
  const openMarketplace = (label: string, key: string, productName: string) => {
    if (key === "tiktok") {
      const link = getTikTokProductLink(productName);
      if (link) {
        window.open(link, "_blank", "noopener,noreferrer");
        return;
      }
    }
    setMissingMp(label);
  };

  return (
    <div className="container-site py-5">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <span className="text-muted">Keranjang</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Keranjang</h1>
        {count > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-xs font-semibold text-muted-2 transition-colors hover:text-red-500"
          >
            Kosongkan Keranjang
          </button>
        )}
      </div>

      {count === 0 ? (
        <div className="mt-10 rounded-2xl border border-gray-100 bg-white py-20 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-muted-2">
            <ShoppingCart className="h-8 w-8" />
          </div>
          <p className="mt-4 text-lg font-semibold text-ink">Keranjang Anda masih kosong</p>
          <p className="mt-1 text-sm text-muted">Simpan produk yang ingin Anda beli di sini.</p>
          <Link
            href="/produk"
            className="mt-5 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2"
          >
            Mulai Belanja
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <Link href={`/produk/${item.id}`} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-24 w-24 rounded-xl border border-gray-100 object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/produk/${item.id}`}
                    className="line-clamp-2 text-sm font-medium leading-snug text-ink transition-colors hover:text-brand"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-base font-bold text-brand">{item.price}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-2">Beli via:</span>
                    <button
                      type="button"
                      onClick={() => setWaSingle(item)}
                      aria-label={`Beli ${item.name} via WhatsApp`}
                      className="flex items-center gap-1 rounded-lg border border-[#25D366]/50 bg-[#25D366]/10 px-2 py-1 text-[11px] font-semibold text-[#128C4B] transition-colors hover:bg-[#25D366]/20"
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5" />
                      WhatsApp
                    </button>
                    {marketplaces.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => openMarketplace(m.label, m.key, item.name)}
                        aria-label={`Beli ${item.name} via ${m.label}`}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
                      >
                        <MarketplaceIcon name={m.key} className="h-3 w-auto object-contain" />
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Hapus ${item.name}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-2 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {missingMp && (
            <div className="mt-5">
              <MarketplaceNotice label={missingMp} onClose={() => setMissingMp(null)} />
            </div>
          )}

          {/* WhatsApp checkout summary */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div>
              <p className="text-xs text-muted-2">Total ({count} produk)</p>
              <p className="text-xl font-extrabold text-brand">{formatRupiah(total)}</p>
              <p className="mt-0.5 text-[11px] text-muted-2">
                Ongkir dihitung otomatis saat checkout via WhatsApp
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWaCart(true)}
              className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#1eb85a]"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Pesan via WhatsApp
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center text-sm text-muted">
            Pembayaran &amp; checkout saat ini dilayani melalui WhatsApp. Tombol
            marketplace akan aktif setelah produk tersedia di marketplace resmi.
          </div>

          <WhatsAppOrderModal
            open={waCart}
            onClose={() => setWaCart(false)}
            productName="Checkout Keranjang"
            price={formatRupiah(total)}
            items={items}
          />
          <WhatsAppOrderModal
            open={waSingle !== null}
            onClose={() => setWaSingle(null)}
            productName={waSingle?.name ?? ""}
            price={waSingle?.price ?? ""}
            productId={waSingle?.id}
          />
        </>
      )}
    </div>
  );
}
