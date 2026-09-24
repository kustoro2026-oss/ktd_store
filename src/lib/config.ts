// Marketplace ordering configuration.
//
// Products are sourced from anekadropship.id, but the actual ordering is done
// through external marketplaces (Blibli / TikTok Shop / Lazada).
// Catatan: Tokopedia sudah merger dengan TikTok Shop (ShopTokopedia),
// jadi marketplace Tokopedia tidak ditampilkan terpisah.
//
// By default the buttons search the product name on each marketplace. To point
// to your own store instead, replace the base URL below with your store link
// and keep the product name appended, e.g.:
//   searchUrl: "https://www.blibli.com/search?searchTerm="
//   or a fixed storefront: use a function in `marketplaceLink`.

export type MarketplaceKey = "blibli" | "tiktok" | "lazada";

export type Marketplace = {
  key: MarketplaceKey;
  label: string;
  /** Tailwind-friendly brand color used for the button background. */
  color: string;
  /** Base URL that accepts a search query appended to the end. */
  searchUrl: string;
  /** Optional direct store URL. When set, footer button links here instead of showing "not available" notice. */
  storeUrl?: string;
};

export const marketplaces: Marketplace[] = [
  {
    key: "blibli",
    label: "Blibli",
    color: "#0071ff",
    searchUrl: "https://www.blibli.com/search?searchTerm=",
    storeUrl: "https://blibli.onelink.me/GNtk/fw29u5fy",
  },
  {
    key: "tiktok",
    label: "TikTok Shop",
    color: "#111111",
    searchUrl: "https://www.tiktok.com/search?q=",
    storeUrl: "https://vt.tiktok.com/ZSqHkP3o1/?page=Mall",
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
// Used for canonical/OG URLs, robots.txt and the sitemap.
// Priority: NEXT_PUBLIC_SITE_URL > VERCEL_PROJECT_PRODUCTION_URL > VERCEL_URL > localhost

function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  // Vercel production URL (e.g. toko.kustoro2026.com)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  // Vercel preview URL (e.g. project-git-branch.vercel.app)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl().replace(/\/+$/, "");

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
  /**
   * Multi-paket (keranjang beda seller): satu entri per paket, lengkap dengan
   * daftar produk yang ada di paket tersebut (peta produk -> paket).
   * `label` opsional; sengaja tidak diisi dengan alamat seller agar asal
   * gudang tidak terlihat pembeli — paket cukup tampil sebagai "Paket N".
   */
  groups?: { label?: string; courier: string; cost: string; items?: string[] }[];
};

// ─── Metode pembayaran ───────────────────────────────────────────────────────
//
// Pilihan pembayaran pada form pesanan WhatsApp: COD (bayar di tempat) atau
// transfer bank. Nomor rekening diisi di BANK_ACCOUNTS di bawah.

export type PaymentMethod = {
  key: "cod" | "transfer";
  label: string;
  note: string;
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    key: "cod",
    label: "COD (Bayar di Tempat)",
    note: "Bayar tunai saat paket diterima (biaya COD per paket).",
  },
  {
    key: "transfer",
    label: "Transfer Bank",
    note: "Transfer ke rekening di bawah, lalu kirim bukti via WhatsApp.",
  },
];

/** Biaya tambahan untuk metode pembayaran COD (Cash on Delivery). */
export const COD_FEE = 2500;

export type BankAccount = {
  bank: string;
  accountNumber: string;
  accountName: string;
};

/** Rekening toko untuk pembayaran transfer bank. */
export const BANK_ACCOUNTS: BankAccount[] = [
  { bank: "Mandiri", accountNumber: "1340025493742", accountName: "KUSTORO" },
];

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
  /** Metode pembayaran yang dipilih pembeli (label tampilan). */
  payment?: string;
  /** Biaya COD (Rp) jika pembeli memilih COD. */
  codFee?: number;
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
  if (i.payment) lines.push(`Metode Pembayaran: ${i.payment}`);
  if (i.codFee && i.codFee > 0) lines.push(`Biaya COD: Rp ${i.codFee.toLocaleString("id-ID")}`);
  if (i.shipping) {
    if (i.shipping.groups && i.shipping.groups.length > 1) {
      lines.push("", `Pengiriman (${i.shipping.groups.length} paket terpisah):`);
      i.shipping.groups.forEach((g, idx) => {
        lines.push(g.label ? `Paket ${idx + 1} — ${g.label}` : `Paket ${idx + 1}`);
        if (g.items && g.items.length > 0) {
          for (const n of g.items) lines.push(`  • ${n}`);
        }
        lines.push(`  Kurir: ${g.courier} — ${g.cost}`);
      });
      lines.push(`Ongkir Total: ${i.shipping.cost}`, `Total: ${i.shipping.total}`);
    } else {
      lines.push("", "Pengiriman:", `Kurir: ${i.shipping.courier}`, `Ongkir: ${i.shipping.cost}`, `Total: ${i.shipping.total}`);
    }
  }
  if (i.note) lines.push(`Catatan: ${i.note}`);
  return lines.join("\n");
}
