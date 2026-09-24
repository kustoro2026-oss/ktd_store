/**
 * Meta (Facebook/Instagram) Pixel helper — client-side only.
 *
 * Pixel ID dibaca dari NEXT_PUBLIC_META_PIXEL_ID (.env.local / env Vercel).
 * Bila kosong, SEMUA pemanggilan otomatis menjadi no-op — jadi aman untuk
 * development, preview, dan production tanpa iklan.
 *
 * Base code pixel dimuat oleh <MetaPixel /> di root layout; file ini hanya
 * mengirim event (TIDAK memuat script). Nama event & parameter mengikuti
 * spesifikasi Meta: https://developers.facebook.com/docs/meta-pixel/reference
 *
 * Peta event untuk model bisnis KTD Store (order via WhatsApp):
 * - PageView          → semua halaman
 * - ViewContent       → halaman detail produk dibuka
 * - AddToCart         → produk masuk keranjang
 * - InitiateCheckout  → modal checkout WhatsApp dibuka (intent beli)
 * - Lead              → pesanan terkirim ke WhatsApp (konversi utama situs)
 * - Contact           → pembeli memilih "Tanya Admin via WA"
 * - MarketplaceClick  → pembeli klik tombol beli di Blibli/TikTok Shop/Lazada
 *                       (event KUSTOM — dikirim via fbq "trackCustom")
 *
 * Catatan optimasi: untuk campaign Click-to-WhatsApp (CTWA), konversi utama
 * dihitung langsung oleh Meta dari percakapan WhatsApp — event pixel di sini
 * memperkaya data audiens & retargeting, bukan satu-satunya sumber konversi.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Pixel ID dari env build-time. Kosong = tracking nonaktif. */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

/** True bila pixel dikonfigurasi DAN kode berjalan di browser. */
export function isPixelEnabled(): boolean {
  return Boolean(META_PIXEL_ID) && typeof window !== "undefined";
}

/** Kirim event ke pixel (no-op bila pixel tidak aktif / belum termuat). */
export function pixelEvent(event: string, params?: Record<string, unknown>): void {
  if (!isPixelEnabled()) return;
  if (typeof window.fbq !== "function") return;
  window.fbq("track", event, params);
}

/** Kirim event KUSTOM ke pixel — untuk sinyal di luar daftar event standar Meta. */
export function pixelCustomEvent(event: string, params?: Record<string, unknown>): void {
  if (!isPixelEnabled()) return;
  if (typeof window.fbq !== "function") return;
  window.fbq("trackCustom", event, params);
}

/** Konversi harga tampilan ("Rp 47.000") menjadi angka untuk parameter value. */
export function parsePriceValue(s: string): number {
  const d = String(s ?? "").replace(/\D/g, "");
  return d ? Number(d) : 0;
}

const CURRENCY = "IDR";

/** Halaman detail produk dibuka. */
export function pixelViewContent(p: { id: string; name: string; price?: string }): void {
  pixelEvent("ViewContent", {
    content_ids: [p.id],
    content_name: p.name,
    content_type: "product",
    value: parsePriceValue(p.price ?? ""),
    currency: CURRENCY,
  });
}

/** Produk dimasukkan ke keranjang. */
export function pixelAddToCart(p: { id: string; name: string; price?: string }): void {
  pixelEvent("AddToCart", {
    content_ids: [p.id],
    content_name: p.name,
    content_type: "product",
    value: parsePriceValue(p.price ?? ""),
    currency: CURRENCY,
  });
}

/** Modal checkout WhatsApp dibuka — sinyal intent beli. */
export function pixelInitiateCheckout(p: { ids: string[]; value: number; numItems: number }): void {
  pixelEvent("InitiateCheckout", {
    content_ids: p.ids,
    content_type: "product",
    num_items: p.numItems,
    value: p.value,
    currency: CURRENCY,
  });
}

/** Pesanan berhasil terkirim ke WhatsApp — konversi utama situs. */
export function pixelLead(p: { ids: string[]; value: number }): void {
  pixelEvent("Lead", {
    content_ids: p.ids,
    content_type: "product",
    value: p.value,
    currency: CURRENCY,
  });
}

/** Pembeli menghubungi admin via WhatsApp tanpa menyelesaikan form. */
export function pixelContact(p?: { ids?: string[] }): void {
  pixelEvent("Contact", p?.ids?.length ? { content_ids: p.ids } : undefined);
}

/** Pembeli beralih ke marketplace lain (Blibli/TikTok Shop/Lazada) — sinyal
 *  minat beli di luar situs; berguna untuk audiens retargeting & mengetahui
 *  channel mana yang dipilih. Dikirim sebagai event kustom "MarketplaceClick". */
export function pixelMarketplaceClick(p: {
  marketplace: string;
  id: string;
  name: string;
  price?: string;
}): void {
  pixelCustomEvent("MarketplaceClick", {
    marketplace: p.marketplace,
    content_ids: [p.id],
    content_name: p.name,
    content_type: "product",
    value: parsePriceValue(p.price ?? ""),
    currency: CURRENCY,
  });
}
