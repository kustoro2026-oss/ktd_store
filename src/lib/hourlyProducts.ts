/**
 * Utilitas rotasi produk per jam untuk section beranda ("Produk Terbaru" &
 * "Produk Terlaris"): masing-masing menampilkan 16 produk anekadropship +
 * 16 produk Evermos yang dipilih acak dari pool kandidat, namun DETERMINISTIK
 * per jam — server (ISR) dan klien memakai fungsi yang sama sehingga semua
 * pengunjung pada jam yang sama melihat daftar yang sama, dan daftar berganti
 * setiap pergantian jam.
 */
import type { CardProduct } from "./anekadropship";

export const HOUR_MS = 3_600_000;
/** Jumlah kandidat per sumber yang dikirim ke klien. */
export const POOL_SIZE = 64;
/** Jumlah kartu yang tampil per sumber (aneka & Evermos). */
export const PER_SOURCE = 16;

/** Salt pemisah undian antar section (Terbaru vs Terlaris). */
export const SALT_BARU = 0x9e3779b9;
export const SALT_LARIS = 0x85ebca6b;

/** Nomor jam sejak epoch UTC — basis seed rotasi. */
export function hourSeed(now: number = Date.now()): number {
  return Math.floor(now / HOUR_MS);
}

/** PRNG mulberry32 — deterministik & terdistribusi merata dari satu seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates dengan RNG tersuntik (hasil deterministik per seed). */
export function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pilihan kartu untuk satu jam: 16 aneka + 16 Evermos (bila tersedia), urutan
 * akhir dicampur. Seed = jam ^ salt; salt membedakan section Terbaru/Terlaris
 * agar kedua section tidak menampilkan pilihan yang sama.
 */
export function pickHourly(
  anekaPool: CardProduct[],
  evmPool: CardProduct[],
  seed: number,
  salt: number,
): CardProduct[] {
  const rng = mulberry32((seed ^ salt) >>> 0);
  const aneka = seededShuffle(anekaPool, rng).slice(0, PER_SOURCE);
  const evm = seededShuffle(evmPool, rng).slice(0, PER_SOURCE);
  return seededShuffle([...aneka, ...evm], rng);
}

/** Parse "7,7rb" → 7700, "1,2RB" → 1200, "500" → 500 */
export function parseSold(sold: string): number {
  if (!sold) return 0;
  const s = sold.toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
  const rb = s.match(/^([\d,]+)rb$/);
  if (rb) return Math.round(parseFloat(rb[1].replace(",", ".")) * 1000);
  const k = s.match(/^([\d,]+)k$/);
  if (k) return Math.round(parseFloat(k[1].replace(",", ".")) * 1000);
  return parseInt(s, 10) || 0;
}
