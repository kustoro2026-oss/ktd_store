/**
 * Harga override KTD Store — supaya situs toko menampilkan dan menagih harga
 * yang diatur dari KTD Hub (menu KTD Store → Harga Massal), bukan harga
 * rekomendasi katalog Aneka.
 *
 * Data diambil dari endpoint publik KTD Hub (GET /api/ktd-store/harga) dan
 * disimpan di state module (per worker) dengan TTL 60 detik, selaras dengan
 * cache endpoint — perubahan harga dari KTD Hub menyebar ke situs dalam
 * ±2-3 menit. Kegagalan jaringan tidak mengganggu render: harga lama (atau
 * harga katalog) tetap dipakai.
 */

// Override stok dimuat bersama di muatHargaKtd (satu titik pemanggilan yang
// sudah dipakai semua halaman/route) — tak perlu menyentuh tiap call site.
import { muatStokKtd } from "./ktd-store-stok";

const HARGA_URL =
  process.env.KTD_HUB_HARGA_URL ?? "https://admin.kustoro2026.com/api/ktd-store/harga";

const TTL_MS = 60 * 1000;

const state = globalThis as unknown as {
  __ktdHarga?: { at: number; data: Record<string, number> };
};

/** Muat (dan cache) peta override dari KTD Hub. Aman dipanggil berkali-kali —
 *  panggilan berikutnya langsung lewat selama data masih segar. */
export async function muatHargaKtd(): Promise<void> {
  // Stok punya TTL sendiri; muatStokKtd langsung lewat bila masih segar.
  await muatStokKtd();
  const hit = state.__ktdHarga;
  if (hit && Date.now() - hit.at < TTL_MS) return;
  try {
    const res = await fetch(HARGA_URL, { next: { revalidate: 60 } });
    if (!res.ok) return;
    const json = (await res.json()) as { ok?: boolean; data?: Record<string, number> };
    if (!json.ok || !json.data) return;
    state.__ktdHarga = { at: Date.now(), data: json.data };
  } catch {
    // Gagal jaringan — data lama (atau harga katalog) tetap dipakai.
  }
}

/** Peta override aktif; null bila belum pernah berhasil dimuat. */
export function petaHargaKtd(): Map<string, number> | null {
  const hit = state.__ktdHarga;
  if (!hit) return null;
  return new Map(Object.entries(hit.data));
}

/** Format angka → "Rp 25.000" (selaras format rekomendasiJual di katalog). */
export function formatHargaKtd(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}
