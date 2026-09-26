"use client";

import { useEffect, useRef, useState } from "react";
import type { CardProduct } from "./anekadropship";
import { hourSeed, pickHourly } from "./hourlyProducts";

/**
 * Daftar kartu yang berganti acak setiap jam (16 aneka + 16 Evermos).
 *
 * `initialItems` adalah pilihan yang dirender server (SSR/ISR) memakai seed
 * jam saat halaman dibuat — dipakai selama jam belum berganti sehingga tidak
 * ada hydration mismatch. Saat jam berganti (atau halaman dilayani dari cache
 * jam sebelumnya), daftar dihitung ulang di klien dengan fungsi deterministik
 * yang sama seperti server.
 */
export function useHourlyProducts(
  anekaPool: CardProduct[],
  evmPool: CardProduct[],
  initialItems: CardProduct[],
  initialSeed: number,
  salt: number,
): CardProduct[] {
  const [items, setItems] = useState(initialItems);
  const lastSeed = useRef(initialSeed);

  useEffect(() => {
    if (!anekaPool.length && !evmPool.length) return;
    const apply = () => {
      const now = hourSeed();
      if (now !== lastSeed.current) {
        lastSeed.current = now;
        setItems(pickHourly(anekaPool, evmPool, now, salt));
      }
    };
    // Cek susulan setelah mount via timeout (menghindari setState sinkron di
    // body effect — aturan ESLint react-hooks/set-state-in-effect), lalu
    // pantau pergantian jam setiap menit.
    const t = window.setTimeout(apply, 0);
    const iv = window.setInterval(apply, 60_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(iv);
    };
  }, [anekaPool, evmPool, salt]);

  return items;
}
