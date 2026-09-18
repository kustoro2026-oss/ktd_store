/**
 * Promo / harga coret utility.
 *
 * Logika:
 * - Harga coret = rekomendasiJual + MARKUP_PERCENT%
 * - Hanya berlaku untuk produk dengan harga >= MIN_PRICE
 * - Threshold & persentase bisa diubah di sini.
 *
 * Flash Sale:
 * - Diskon lebih besar untuk produk stok rendah.
 * - Hanya muncul di jam-jam tertentu (FLASH_SALE_SCHEDULE).
 * - Ada safety check profit minimum agar tidak rugi.
 * - Countdown timer menghitung mundur ke akhir sesi.
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
export const FLASH_SALE_DISCOUNT_PERCENT = 15;

/** Jumlah maksimum produk yang ditampilkan di section Flash Sale. */
export const FLASH_SALE_MAX_ITEMS = 12;

/**
 * Profit minimum (dalam rupiah) setelah diskon Flash Sale.
 * Produk yang setelah diskon 15% untungnya di bawah ini TIDAK akan masuk Flash Sale.
 * Contoh: modal=28.000, jual=30.000 → flash=25.500 → profit=-2.500 → DITOLAK.
 */
export const FLASH_SALE_MIN_PROFIT = 5000;

/**
 * Jam operasional Flash Sale (WIB, UTC+7).
 * Format: [jam_mulai, jam_selesai] dalam 0-23.
 * Flash Sale hanya muncul di rentang jam ini.
 */
export const FLASH_SALE_SCHEDULE: [number, number][] = [
    [9, 12],   // Pagi: 09:00 - 12:00 WIB
    [19, 23],  // Malam: 19:00 - 23:00 WIB
];

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
 * Dapatkan waktu sekarang dalam WIB (UTC+7) sebagai Date object.
 */
export function nowWIB(): Date {
    const now = new Date();
    return new Date(now.getTime() + 7 * 3600_000);
}

/**
 * Cek apakah Flash Sale sedang aktif berdasarkan jadwal.
 * Return [active, endTime] — active=true jika sekarang dalam rentang jadwal,
 * endTime adalah Date object kapan sesi ini berakhir (untuk countdown).
 */
export function getFlashSaleStatus(): {
    active: boolean;
    endTime: Date;
    nextStart: Date | null;
} {
    const wib = nowWIB();
    const currentHour = wib.getHours();
    const currentMinute = wib.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;

    // Cari sesi yang sedang berlangsung
    for (const [startH, endH] of FLASH_SALE_SCHEDULE) {
        const startMin = startH * 60;
        const endMin = endH * 60;
        if (currentMinutes >= startMin && currentMinutes < endMin) {
            const endTime = new Date(wib);
            endTime.setHours(endH, 0, 0, 0);
            return { active: true, endTime, nextStart: null };
        }
    }

    // Tidak aktif — cari sesi berikutnya
    let nextStart: Date | null = null;
    let earliest = Infinity;
    for (const [startH] of FLASH_SALE_SCHEDULE) {
        const startMin = startH * 60;
        let diff = startMin - currentMinutes;
        if (diff <= 0) diff += 24 * 60; // besok
        if (diff < earliest) {
            earliest = diff;
            nextStart = new Date(wib);
            nextStart.setHours(startH, 0, 0, 0);
            if (startMin <= currentMinutes) {
                nextStart.setDate(nextStart.getDate() + 1);
            }
        }
    }

    return { active: false, endTime: new Date(wib), nextStart };
}

/**
 * Hitung sisa detik hingga Flash Sale berakhir (sesi saat ini).
 * Return 0 jika tidak sedang dalam sesi.
 */
export function secondsUntilFlashSaleEnds(): number {
    const { active, endTime } = getFlashSaleStatus();
    if (!active) return 0;
    const wib = nowWIB();
    return Math.max(0, Math.floor((endTime.getTime() - wib.getTime()) / 1000));
}

/**
 * Cek apakah produk layak masuk Flash Sale.
 * Syarat:
 * 1. harga >= FLASH_SALE_MIN_PRICE
 * 2. stok > 0 DAN stok <= FLASH_SALE_MAX_STOCK
 * 3. (jika hargaModal diberikan) profit setelah diskon >= FLASH_SALE_MIN_PROFIT
 */
export function isFlashSaleProduct(
    rekomendasiJual: string,
    stok: string,
    hargaModal?: string,
): boolean {
    const harga = parseRupiah(rekomendasiJual);
    const stock = parseStock(stok);
    if (harga < FLASH_SALE_MIN_PRICE || stock <= 0 || stock > FLASH_SALE_MAX_STOCK) {
        return false;
    }
    // Safety check: profit setelah diskon harus >= FLASH_SALE_MIN_PROFIT
    if (hargaModal) {
        const modal = parseRupiah(hargaModal);
        if (modal > 0) {
            const diskon = Math.round(harga * (FLASH_SALE_DISCOUNT_PERCENT / 100));
            const profitAfterDiscount = (harga - diskon) - modal;
            if (profitAfterDiscount < FLASH_SALE_MIN_PROFIT) return false;
        }
    }
    return true;
}

/**
 * Hitung harga flash sale (harga setelah diskon flash sale).
 * Return null jika harga tidak valid.
 *
 * Contoh: rekomendasiJual = "Rp 50.000", FLASH_SALE_DISCOUNT = 15
 * → { flashPrice: "Rp 42.500", coret: "Rp 50.000", persen: 15, hemat: "Rp 7.500" }
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