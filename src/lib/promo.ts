/**
 * Promo / harga coret utility.
 *
 * Logika:
 * - Harga coret = rekomendasiJual + MARKUP_PERCENT%
 * - Hanya berlaku untuk produk dengan jumlah terjual >= THRESHOLD
 * - Threshold & persentase bisa diubah di sini.
 */

/** Minimum jumlah terjual agar produk mendapat badge promo + harga coret. */
export const PROMO_THRESHOLD = 50;

/** Persentase markup harga coret dari harga jual (10 = 10%). */
export const PROMO_MARKUP_PERCENT = 10;

/**
 * Parse string "terjual" dari anekadropship ke number.
 * Mendukung: "1.2RB" → 1200, "500" → 500, "1,5RB" → 1500, "2RB" → 2000.
 */
export function parseTerjual(terjual: string): number {
    if (!terjual) return 0;
    const s = terjual.trim().toLowerCase().replace(/\s+/g, "");
    // Format "1.2rb" / "1,5rb"
    const rbMatch = s.match(/^([\d.,]+)rb$/);
    if (rbMatch) {
        const raw = rbMatch[1].replace(/\./g, "").replace(",", ".");
        const n = parseFloat(raw);
        return Number.isFinite(n) ? Math.round(n * 1000) : 0;
    }
    // Format "1.2k" / "1,5k"
    const kMatch = s.match(/^([\d.,]+)k$/);
    if (kMatch) {
        const raw = kMatch[1].replace(/\./g, "").replace(",", ".");
        const n = parseFloat(raw);
        return Number.isFinite(n) ? Math.round(n * 1000) : 0;
    }
    // Plain number "500" / "1.200" / "1,200"
    const plain = s.replace(/\./g, "").replace(",", ".");
    const n = parseInt(plain, 10);
    return Number.isNaN(n) ? 0 : n;
}

/**
 * Parse string harga (mis. "Rp 50.000" / "50.000" / "50000") ke number.
 */
export function parseRupiah(price: string): number {
    if (!price) return 0;
    const cleaned = price.replace(/[^\d]/g, "");
    const n = parseInt(cleaned, 10);
    return Number.isNaN(n) ? 0 : n;
}

/**
 * Format number ke string rupiah (50000 → "Rp 50.000").
 */
export function formatRupiah(num: number): string {
    return `Rp ${num.toLocaleString("id-ID")}`;
}

/**
 * Cek apakah produk layak dapat promo (harga coret + badge diskon).
 */
export function isProdukPromo(terjual: string): boolean {
    return parseTerjual(terjual) >= PROMO_THRESHOLD;
}

/**
 * Hitung harga coret dari rekomendasiJual.
 * Return null jika harga tidak valid.
 *
 * Contoh: rekomendasiJual = "Rp 50.000", MARKUP = 10
 * → { coret: "Rp 55.000", persen: 10 }
 */
export function hitungHargaCoret(
    rekomendasiJual: string,
): { coret: string; persen: number } | null {
    const harga = parseRupiah(rekomendasiJual);
    if (harga <= 0) return null;
    const coret = Math.round(harga * (1 + PROMO_MARKUP_PERCENT / 100));
    return {
        coret: formatRupiah(coret),
        persen: PROMO_MARKUP_PERCENT,
    };
}