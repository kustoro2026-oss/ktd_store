/**
 * Promo / harga coret utility.
 *
 * Logika:
 * - Harga coret = rekomendasiJual + MARKUP_PERCENT%
 * - Hanya berlaku untuk produk dengan harga >= MIN_PRICE
 * - Threshold & persentase bisa diubah di sini.
 *
 * Flash Sale:
 * - Diskon lebih besar (FLASH_SALE_MARKUP_PERCENT) untuk produk stok rendah.
 * - Countdown timer reset setiap hari pukul 00:00 WIB.
 */

/** Minimum harga (dalam rupiah) agar produk mendapat badge promo + harga coret. */
export const PROMO_MIN_PRICE = 50000;

/** Persentase markup harga coret dari harga jual (10 = 10%). */
export const PROMO_MARKUP_PERCENT = 10;

// ─── Flash Sale ───────────────────────────────────────────────────────────

/** Minimum harga agar produk bisa masuk Flash Sale. */
export const FLASH_SALE_MIN_PRICE = 30000;

/** Maksimum stok agar produk bisa masuk Flash Sale (menciptakan urgency). */
export const FLASH_SALE_MAX_STOCK = 50;

/** Persentase diskon Flash Sale (lebih besar dari promo biasa). */
export const FLASH_SALE_DISCOUNT_PERCENT = 20;

/** Jumlah maksimum produk yang ditampilkan di section Flash Sale. */
export const FLASH_SALE_MAX_ITEMS = 12;

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
 * Parse string stok ke number (mis. "1.234" → 1234, "50" → 50).
 */
export function parseStock(stok: string): number {
    if (!stok) return 0;
    const n = parseInt(stok.replace(/[^0-9]/g, ""), 10);
    return Number.isNaN(n) ? 0 : n;
}

/**
 * Cek apakah produk layak dapat promo (harga coret + badge diskon).
 * Syarat: harga >= PROMO_MIN_PRICE (default Rp 50.000).
 */
export function isProdukPromo(rekomendasiJual: string): boolean {
    return parseRupiah(rekomendasiJual) >= PROMO_MIN_PRICE;
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

// ─── Flash Sale helpers ───────────────────────────────────────────────────

/**
 * Cek apakah produk layak masuk Flash Sale.
 * Syarat: harga >= FLASH_SALE_MIN_PRICE DAN stok <= FLASH_SALE_MAX_STOCK DAN stok > 0.
 */
export function isFlashSaleProduct(rekomendasiJual: string, stok: string): boolean {
    const harga = parseRupiah(rekomendasiJual);
    const stock = parseStock(stok);
    return harga >= FLASH_SALE_MIN_PRICE && stock > 0 && stock <= FLASH_SALE_MAX_STOCK;
}

/**
 * Hitung harga flash sale (harga setelah diskon flash sale).
 * Return null jika harga tidak valid.
 *
 * Contoh: rekomendasiJual = "Rp 50.000", FLASH_SALE_DISCOUNT = 20
 * → { flashPrice: "Rp 40.000", coret: "Rp 50.000", persen: 20, hemat: "Rp 10.000" }
 */
export function hitungFlashSale(
    rekomendasiJual: string,
): { flashPrice: string; coret: string; persen: number; hemat: string } | null {
    const harga = parseRupiah(rekomendasiJual);
    if (harga <= 0) return null;
    const diskon = Math.round(harga * (FLASH_SALE_DISCOUNT_PERCENT / 100));
    const flashPrice = harga - diskon;
    return {
        flashPrice: formatRupiah(flashPrice),
        coret: formatRupiah(harga),
        persen: FLASH_SALE_DISCOUNT_PERCENT,
        hemat: formatRupiah(diskon),
    };
}

/**
 * Hitung sisa detik hingga pukul 00:00 WIB (UTC+7) berikutnya.
 * Dipakai untuk countdown timer Flash Sale.
 */
export function secondsUntilMidnightWIB(): number {
    const now = new Date();
    // WIB = UTC+7
    const wibNow = new Date(now.getTime() + 7 * 3600_000);
    const midnight = new Date(wibNow);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - wibNow.getTime()) / 1000);
}