// Marketplace ordering configuration.
//
// Products are sourced from anekadropship.id, but the actual ordering is done
// through external marketplaces (Shopee / TikTok Shop / Lazada).
//
// By default the buttons search the product name on each marketplace. To point
// to your own store instead, replace the base URL below with your store link
// and keep the product name appended, e.g.:
//   searchUrl: "https://shopee.co.id/yourstore?keyword="
//   or a fixed storefront: use a function in `marketplaceLink`.

export type MarketplaceKey = "shopee" | "tiktok" | "lazada";

export type Marketplace = {
  key: MarketplaceKey;
  label: string;
  /** Tailwind-friendly brand color used for the button background. */
  color: string;
  /** Base URL that accepts a search query appended to the end. */
  searchUrl: string;
};

export const marketplaces: Marketplace[] = [
  {
    key: "shopee",
    label: "Shopee",
    color: "#ee4d2d",
    searchUrl: "https://shopee.co.id/search?keyword=",
  },
  {
    key: "tiktok",
    label: "TikTok Shop",
    color: "#111111",
    searchUrl: "https://www.tiktok.com/search?q=",
  },
  {
    key: "lazada",
    label: "Lazada",
    color: "#0f146d",
    searchUrl: "https://www.lazada.co.id/catalog/?q=",
  },
];

export function marketplaceLink(m: Marketplace, productName: string): string {
  return m.searchUrl + encodeURIComponent(productName);
}

// ─── Site URL ────────────────────────────────────────────────────────────────
//
// Used for canonical/OG URLs, robots.txt and the sitemap. Set
// NEXT_PUBLIC_SITE_URL in .env.local when deploying (e.g. https://ktdstore.id).

export const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

// ─── WhatsApp ordering ────────────────────────────────────────────────────────
//
// Products can also be ordered directly via WhatsApp. The destination number is
// the store owner's number (set it in .env.local as NEXT_PUBLIC_WHATSAPP_NUMBER,
// digits only with country code, e.g. 6285171157938).

export const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "6285171157938";

/** Build a wa.me deep link with a pre-filled message. */
export function whatsappLink(message: string): string {
  const num = WHATSAPP_NUMBER.replace(/\D/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

/** WhatsApp number formatted for display, e.g. "0851 7115 7938". */
export function whatsappDisplay(): string {
  const d = WHATSAPP_NUMBER.replace(/\D/g, "");
  const local = d.startsWith("62") ? "0" + d.slice(2) : d;
  const groups = local.match(/^(\d{4})(\d{4})(\d{2,})$/);
  return groups ? `${groups[1]} ${groups[2]} ${groups[3]}` : local;
}

export type WhatsAppShipping = {
  courier: string;
  cost: string;
  total: string;
};

export type WhatsAppOrderInput = {
  productName: string;
  price: string;
  productUrl: string;
  name: string;
  phone: string;
  address: string;
  qty: string;
  note: string;
  shipping?: WhatsAppShipping;
  /** When set (cart checkout), the message lists every item instead of a single product. */
  items?: { name: string; price: string }[];
};

/** Compose the WhatsApp order message (product + recipient details). */
export function buildWhatsAppOrderMessage(i: WhatsAppOrderInput): string {
  const lines = ["Halo, saya ingin memesan produk berikut:"];
  if (i.items && i.items.length > 0) {
    lines.push("", "Daftar Produk:");
    i.items.forEach((it, idx) => lines.push(`${idx + 1}. ${it.name} — ${it.price}`));
    lines.push("", `Total Harga: ${i.price}`);
  } else {
    lines.push("", `Nama Produk: ${i.productName}`, `Harga: ${i.price}`, `Link: ${i.productUrl}`);
  }
  lines.push(
    "",
    "Data Penerima:",
    `Nama: ${i.name}`,
    `No. HP: ${i.phone}`,
    `Alamat: ${i.address}`,
  );
  if (i.qty) lines.push(`Jumlah: ${i.qty}`);
  if (i.shipping) {
    lines.push("", "Pengiriman:", `Kurir: ${i.shipping.courier}`, `Ongkir: ${i.shipping.cost}`, `Total: ${i.shipping.total}`);
  }
  if (i.note) lines.push(`Catatan: ${i.note}`);
  return lines.join("\n");
}
