// Katalog produk Top Up & Isi Saldo KTD Store.
// Sumber harga: pricelist Digiflazz (/v1/price-list), diambil 2026-10-06.
// Margin: game 10%, pulsa/data/PLN/e-wallet 3%; sellPrice dibulatkan ke atas 100 rupiah.
// Regenerasi: node scripts/_gen-topup-catalog.cjs

export type TopUpCategory = "game" | "pulsa" | "pln" | "emoney";

export interface TopUpCategoryInfo {
  id: TopUpCategory;
  label: string;
}

export interface TopUpProduct {
  /** buyer_sku_code Digiflazz. */
  sku: string;
  brand: string;
  name: string;
  /** Harga beli dari Digiflazz (Rp). */
  costPrice: number;
  /** Harga jual ke pembeli (Rp), sudah termasuk margin. */
  sellPrice: number;
  category: TopUpCategory;
  /** Produk Mobile Legends: butuh kolom Server/Zone. */
  needsServer?: boolean;
  /** Label kolom input nomor tujuan (ID game / nomor HP / nomor meter). */
  customerNoLabel: string;
}

export const TOPUP_CATEGORIES: TopUpCategoryInfo[] = [
  { id: "game", label: "Game" },
  { id: "pulsa", label: "Pulsa & Data" },
  { id: "pln", label: "Token Listrik" },
  { id: "emoney", label: "E-Wallet & TV" },
];

export const TOPUP_PRODUCTS: TopUpProduct[] = [
  { sku: "ff12", brand: "FREE FIRE", name: "Free Fire 12 Diamond", costPrice: 1902, sellPrice: 2100, category: "game", customerNoLabel: "ID Free Fire" },
  { sku: "ff50", brand: "FREE FIRE", name: "Free Fire 50 Diamond", costPrice: 6235, sellPrice: 6900, category: "game", customerNoLabel: "ID Free Fire" },
  { sku: "ff70", brand: "FREE FIRE", name: "Free Fire 70 Diamond", costPrice: 10117, sellPrice: 11200, category: "game", customerNoLabel: "ID Free Fire" },
  { sku: "ff140", brand: "FREE FIRE", name: "Free Fire 140 Diamond", costPrice: 16180, sellPrice: 17800, category: "game", customerNoLabel: "ID Free Fire" },
  { sku: "ff355", brand: "FREE FIRE", name: "Free Fire 355 Diamond", costPrice: 41500, sellPrice: 45700, category: "game", customerNoLabel: "ID Free Fire" },
  { sku: "ml5", brand: "MOBILE LEGENDS", name: "MOBILE LEGENDS 5 Diamond", costPrice: 1592, sellPrice: 1800, category: "game", customerNoLabel: "ID Game (User ID)", needsServer: true },
  { sku: "ml10", brand: "MOBILE LEGENDS", name: "MOBILE LEGENDS 10 Diamond", costPrice: 3156, sellPrice: 3500, category: "game", customerNoLabel: "ID Game (User ID)", needsServer: true },
  { sku: "ml12", brand: "MOBILE LEGENDS", name: "MOBILE LEGENDS 12 Diamond", costPrice: 3792, sellPrice: 4200, category: "game", customerNoLabel: "ID Game (User ID)", needsServer: true },
  { sku: "mlweek", brand: "MOBILE LEGENDS", name: "MOBILE LEGENDS Weekly Diamond Pass", costPrice: 30481, sellPrice: 33600, category: "game", customerNoLabel: "ID Game (User ID)", needsServer: true },
  { sku: "ax5", brand: "AXIS", name: "Axis 5.000", costPrice: 5865, sellPrice: 6100, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "vax1", brand: "AXIS", name: "Aktivasi Voucher Axis 1 GB 1 Hari", costPrice: 6530, sellPrice: 6800, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "ax10", brand: "AXIS", name: "Axis 10.000", costPrice: 10855, sellPrice: 11200, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "axdss2", brand: "AXIS", name: "Axis Data SS 2 GB 3 Hari", costPrice: 10900, sellPrice: 11300, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "vax2", brand: "AXIS", name: "Aktivasi Voucher Axis 3 GB 3 Hari", costPrice: 11460, sellPrice: 11900, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "axdj1", brand: "AXIS", name: "Axis Data Jawa 2.5 GB 5 Hari", costPrice: 12360, sellPrice: 12800, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "axp3g60d", brand: "AXIS", name: "Aktivasi Perdana Axis 3 GB 60 Hari (SP5K SP7K)", costPrice: 13905, sellPrice: 14400, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "byu10", brand: "by.U", name: "by.U 10.000", costPrice: 10205, sellPrice: 10600, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "yellow1", brand: "INDOSAT", name: "Indosat Yellow 1 GB 1 Hari", costPrice: 6005, sellPrice: 6200, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "i5", brand: "INDOSAT", name: "Indosat 5.000", costPrice: 6755, sellPrice: 7000, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "i10", brand: "INDOSAT", name: "Indosat 10.000", costPrice: 11390, sellPrice: 11800, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "if3g3d", brand: "INDOSAT", name: "Indosat Freedom Internet 3 GB 3 Hari", costPrice: 12215, sellPrice: 12600, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "if2", brand: "INDOSAT", name: "Indosat Freedom Internet 2.5 GB 5 Hari", costPrice: 14260, sellPrice: 14700, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "i20", brand: "INDOSAT", name: "Indosat 20.000", costPrice: 21913, sellPrice: 22600, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "i25", brand: "INDOSAT", name: "Indosat 25.000", costPrice: 25872, sellPrice: 26700, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "if3g30d", brand: "INDOSAT", name: "Indosat Freedom Internet 3 GB 28 Hari", costPrice: 29610, sellPrice: 30500, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "i30", brand: "INDOSAT", name: "Indosat 30.000", costPrice: 30690, sellPrice: 31700, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "iactive90", brand: "INDOSAT", name: "Indosat Tambah Masa Aktif Kartu 90 Hari", costPrice: 31230, sellPrice: 32200, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "if5g30d", brand: "INDOSAT", name: "Indosat Freedom Internet 5.5 GB 28 Hari", costPrice: 33050, sellPrice: 34100, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "i50", brand: "INDOSAT", name: "Indosat 50.000", costPrice: 49545, sellPrice: 51100, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "sm10", brand: "SMARTFREN", name: "Smartfren 10.000", costPrice: 10015, sellPrice: 10400, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "smdu1", brand: "SMARTFREN", name: "Smartfren Data Unlimited Harian 1 GB Berlaku 7 Hari", costPrice: 15480, sellPrice: 16000, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "smdu2", brand: "SMARTFREN", name: "Smartfren Data Unlimited Harian 2 GB Berlaku 28 Hari", costPrice: 89724, sellPrice: 92500, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "pas10", brand: "TELKOMSEL", name: "Telkomsel Telepon Pas 10.000", costPrice: 3910, sellPrice: 4100, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "s5", brand: "TELKOMSEL", name: "Telkomsel 5.000", costPrice: 5110, sellPrice: 5300, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "s10", brand: "TELKOMSEL", name: "Telkomsel 10.000", costPrice: 10205, sellPrice: 10600, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "pas20", brand: "TELKOMSEL", name: "Telkomsel Telepon Pas 20.000", costPrice: 10600, sellPrice: 11000, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "flash1", brand: "TELKOMSEL", name: "Telkomsel Data Flash 1 GB 30 Hari", costPrice: 10950, sellPrice: 11300, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "vs2g5d", brand: "TELKOMSEL", name: "Voucher Telkomsel 2.5 GB 5 Hari (Jawa Barat)", costPrice: 13699, sellPrice: 14200, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "s15", brand: "TELKOMSEL", name: "Telkomsel 15.000", costPrice: 14995, sellPrice: 15500, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "s20", brand: "TELKOMSEL", name: "Telkomsel 20.000", costPrice: 19835, sellPrice: 20500, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "flash2", brand: "TELKOMSEL", name: "Telkomsel Data Flash 2 GB 30 Hari", costPrice: 21525, sellPrice: 22200, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "s25", brand: "TELKOMSEL", name: "Telkomsel 25.000", costPrice: 24699, sellPrice: 25500, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "flash3", brand: "TELKOMSEL", name: "Telkomsel Data Flash 3 GB 30 Hari", costPrice: 26100, sellPrice: 26900, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "s30", brand: "TELKOMSEL", name: "Telkomsel 30.000", costPrice: 29805, sellPrice: 30700, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "pas50", brand: "TELKOMSEL", name: "Telkomsel Telepon Pas 50.000", costPrice: 48525, sellPrice: 50000, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "s50", brand: "TELKOMSEL", name: "Telkomsel 50.000", costPrice: 50050, sellPrice: 51600, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "s100", brand: "TELKOMSEL", name: "Telkomsel 100.000", costPrice: 98770, sellPrice: 101800, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "t5", brand: "TRI", name: "Three 5.000", costPrice: 5125, sellPrice: 5300, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "happy1", brand: "TRI", name: "Tri Data Happy 1.5 GB 1 Hari", costPrice: 7770, sellPrice: 8100, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "t10", brand: "TRI", name: "Three 10.000", costPrice: 10765, sellPrice: 11100, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "happy3", brand: "TRI", name: "Tri Data Happy 3 GB 3 Hari", costPrice: 12350, sellPrice: 12800, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "t20", brand: "TRI", name: "Three 20.000", costPrice: 19858, sellPrice: 20500, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "tactive4m", brand: "TRI", name: "Tri Tambah Masa Aktif Kartu  4 Bulan", costPrice: 25443, sellPrice: 26300, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "x5", brand: "XL", name: "Xl 5.000", costPrice: 5851, sellPrice: 6100, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "x10", brand: "XL", name: "Xl 10.000", costPrice: 10860, sellPrice: 11200, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "hotrod3g10d", brand: "XL", name: "Aktivasi Voucher XL XTRA HotRod Special 3 GB 10 Hari", costPrice: 24030, sellPrice: 24800, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "flexs", brand: "XL", name: "XL Xtra Combo Flex S 28 Hari", costPrice: 32155, sellPrice: 33200, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "vflexs", brand: "XL", name: "Aktivasi Voucher XL Xtra Combo Flex S 28 Hari", costPrice: 32720, sellPrice: 33800, category: "pulsa", customerNoLabel: "Nomor HP" },
  { sku: "pln20", brand: "PLN", name: "PLN 20.000", costPrice: 20830, sellPrice: 21500, category: "pln", customerNoLabel: "Nomor Meter / ID Pelanggan" },
  { sku: "pln50", brand: "PLN", name: "PLN 50.000", costPrice: 51784, sellPrice: 53400, category: "pln", customerNoLabel: "Nomor Meter / ID Pelanggan" },
  { sku: "pln100", brand: "PLN", name: "PLN 100.000", costPrice: 101450, sellPrice: 104500, category: "pln", customerNoLabel: "Nomor Meter / ID Pelanggan" },
  { sku: "pln1000", brand: "PLN", name: "PLN 1.000.000", costPrice: 1001150, sellPrice: 1031200, category: "pln", customerNoLabel: "Nomor Meter / ID Pelanggan" },
  { sku: "dana20", brand: "DANA", name: "DANA 20.000", costPrice: 20150, sellPrice: 20800, category: "emoney", customerNoLabel: "Nomor HP" },
  { sku: "dana50", brand: "DANA", name: "DANA 50.000", costPrice: 50270, sellPrice: 51800, category: "emoney", customerNoLabel: "Nomor HP" },
  { sku: "go50", brand: "GO PAY", name: "Go Pay 50.000", costPrice: 51825, sellPrice: 53400, category: "emoney", customerNoLabel: "Nomor HP" },
  { sku: "go100", brand: "GO PAY", name: "Go Pay 100.000", costPrice: 101825, sellPrice: 104900, category: "emoney", customerNoLabel: "Nomor HP" },
  { sku: "kvision30d", brand: "K-VISION dan GOL", name: "K-Vision & GOL Paket CLING (CL01)  30 Hari", costPrice: 18930, sellPrice: 19500, category: "emoney", customerNoLabel: "Nomor Pelanggan" },
  { sku: "kvision180d", brand: "K-VISION dan GOL", name: "K-Vision & GOL Paket CLING (CL06)  180 Hari", costPrice: 82525, sellPrice: 85100, category: "emoney", customerNoLabel: "Nomor Pelanggan" },
  { sku: "ovo50", brand: "OVO", name: "OVO 50.000", costPrice: 51425, sellPrice: 53000, category: "emoney", customerNoLabel: "Nomor HP" },
  { sku: "ovo100", brand: "OVO", name: "OVO 100.000", costPrice: 101425, sellPrice: 104500, category: "emoney", customerNoLabel: "Nomor HP" },
  { sku: "pertagas20", brand: "Pertamina Gas", name: "Pertagas 20.000", costPrice: 21935, sellPrice: 22600, category: "emoney", customerNoLabel: "Nomor Pelanggan" },
  { sku: "shopee50", brand: "SHOPEE PAY", name: "SHOPEE PAY 50.000", costPrice: 51000, sellPrice: 52600, category: "emoney", customerNoLabel: "Nomor HP" },
  { sku: "shopee100", brand: "SHOPEE PAY", name: "SHOPEE PAY 100.000", costPrice: 101025, sellPrice: 104100, category: "emoney", customerNoLabel: "Nomor HP" },
];

export function formatRupiah(n: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID").format(n);
}

/** Nomor tujuan Digiflazz: ML = "user_id zone_id", lainnya = id/nomor apa adanya. */
export function customerNoFor(p: TopUpProduct, id: string, server: string): string {
  const uid = id.trim();
  if (!p.needsServer) return uid;
  const zone = server.trim();
  return zone ? `${uid} ${zone}` : uid;
}
