// Klasifikasi kanal Duitku: kode QRIS (inquiry memuat qrString), e-wallet
// (redirect ke halaman pembayaran), kanal tunai/ritel, dan VA bank. Dipakai
// bersama oleh checkout produk (WhatsAppOrderModal) dan halaman top up
// (NominalPicker) agar kategori metode pembayaran konsisten di seluruh situs.

export type DuitkuPaymentMethod = { code: string; name: string; image: string };

/** Kode kanal Duitku yang termasuk QRIS — hasil inquiry memuat qrString. */
export const QRIS_CODES = new Set(["SP", "NQ", "SQ"]);
/** Kode kanal e-wallet/paylater (OVO, DANA, LinkAja, ShopeePay, Indodana, Jenius) — belum didukung tanpa redirect. */
export const EWALLET_CODES = new Set(["OV", "DA", "LA", "SA", "Q1", "MY", "DN", "JP"]);
/** Kode kanal tunai/ritel & minimarket (Indomaret, Alfamart, dll). */
export const RETAIL_CODES = new Set(["FT", "IR", "A2", "AT"]);

/** Label kategori kanal Duitku untuk tampilan overlay pembayaran. */
export const channelCategory = (code?: string) => {
  if (!code) return "Pembayaran Online";
  if (QRIS_CODES.has(code)) return "QRIS";
  if (EWALLET_CODES.has(code)) return "E-Wallet";
  if (RETAIL_CODES.has(code)) return "Mini Market";
  if (code === "VC") return "Kartu Kredit/Debit";
  return "Transfer Bank (VA)";
};

export type DuitkuChannelRow = {
  key: string;
  label: string;
  note: string;
  methods: DuitkuPaymentMethod[];
};

/** Susun baris kategori metode pembayaran dari daftar kanal aktif Duitku —
 *  persis gaya marketplace: logo kiri, label kanan, chevron. Kategori tanpa
 *  kanal aktif disembunyikan. */
export function duitkuRows(methods: DuitkuPaymentMethod[]): DuitkuChannelRow[] {
  const qris = methods.filter((m) => QRIS_CODES.has(m.code));
  const va = methods.filter(
    (m) =>
      !QRIS_CODES.has(m.code) &&
      !EWALLET_CODES.has(m.code) &&
      !RETAIL_CODES.has(m.code) &&
      m.code !== "VC",
  );
  const ewallet = methods.filter((m) => EWALLET_CODES.has(m.code));
  const card = methods.filter((m) => m.code === "VC");
  const retail = methods.filter((m) => RETAIL_CODES.has(m.code));
  return [
    {
      key: "qris",
      label: "QRIS",
      note: "Scan dari semua e-wallet & m-banking",
      methods: qris,
    },
    {
      key: "va",
      label: "TRANSFER BANK (VA)",
      note: "Transfer ke nomor virtual account",
      methods: va,
    },
    {
      key: "ewallet",
      label: "E-WALLET",
      note: "OVO, DANA, LinkAja, ShopeePay",
      methods: ewallet,
    },
    {
      key: "card",
      label: "KARTU KREDIT/DEBIT",
      note: "Visa & Mastercard",
      methods: card,
    },
    {
      key: "retail",
      label: "MINI MARKET",
      note: "Indomaret & Alfamart",
      methods: retail,
    },
  ].filter((r) => r.methods.length > 0);
}
