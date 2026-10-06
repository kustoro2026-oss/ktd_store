// Katalog Top Up Game KTD Store — reseller Digiflazz.
//
// Harga modal diambil dari API /v1/price-list Digiflazz; harga jual =
// modal + margin 10% (dibulatkan ke atas kelipatan 100 agar margin
// tidak pernah kurang dari 10%). Data statis agar halaman cepat dan
// bisa di-render di server; perbarui lewat scripts/_digiflazz_pricelist.cjs
// bila harga supplier berubah.

export const TOPUP_MARGIN = 0.1;

export type TopUpBrand = "MOBILE LEGENDS" | "FREE FIRE";

export type TopUpProduct = {
  /** buyer_sku_code Digiflazz, dikirim apa adanya saat eksekusi. */
  sku: string;
  brand: TopUpBrand;
  name: string;
  /** Harga modal dari supplier (tidak pernah ditampilkan ke pembeli). */
  costPrice: number;
  /** Harga jual ke pembeli (modal + margin, dibulatkan). */
  sellPrice: number;
  /** Butuh kolom Server/Zone (format customer_no "id server"). */
  needsServer: boolean;
};

export const TOPUP_PRODUCTS: TopUpProduct[] = [
  { sku: "ml5", brand: "MOBILE LEGENDS", name: "Mobile Legends 5 Diamond", costPrice: 1592, sellPrice: 1800, needsServer: true },
  { sku: "ml10", brand: "MOBILE LEGENDS", name: "Mobile Legends 10 Diamond", costPrice: 3156, sellPrice: 3500, needsServer: true },
  { sku: "ml12", brand: "MOBILE LEGENDS", name: "Mobile Legends 12 Diamond", costPrice: 3792, sellPrice: 4200, needsServer: true },
  { sku: "mlweek", brand: "MOBILE LEGENDS", name: "Mobile Legends Weekly Diamond Pass", costPrice: 30481, sellPrice: 33600, needsServer: true },
  { sku: "ff12", brand: "FREE FIRE", name: "Free Fire 12 Diamond", costPrice: 1902, sellPrice: 2100, needsServer: false },
  { sku: "ff50", brand: "FREE FIRE", name: "Free Fire 50 Diamond", costPrice: 6235, sellPrice: 6900, needsServer: false },
  { sku: "ff70", brand: "FREE FIRE", name: "Free Fire 70 Diamond", costPrice: 10117, sellPrice: 11200, needsServer: false },
  { sku: "ff140", brand: "FREE FIRE", name: "Free Fire 140 Diamond", costPrice: 16180, sellPrice: 17800, needsServer: false },
  { sku: "ff355", brand: "FREE FIRE", name: "Free Fire 355 Diamond", costPrice: 41500, sellPrice: 45700, needsServer: false },
];

export const TOPUP_BRANDS: TopUpBrand[] = ["MOBILE LEGENDS", "FREE FIRE"];

/** Rp 3.500 */
export function formatRupiah(n: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID").format(n);
}

/**
 * Gabung ID game dan server menjadi customer_no Digiflazz.
 * Mobile Legends memakai format "id server" (dipisah spasi);
 * Free Fire cukup ID saja.
 */
export function customerNoFor(p: TopUpProduct, id: string, server: string): string {
  const uid = id.trim();
  if (!p.needsServer) return uid;
  const zone = server.trim();
  return zone ? `${uid} ${zone}` : uid;
}
