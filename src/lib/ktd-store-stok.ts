/**
 * Stok override KTD Store — supaya situs toko menampilkan stok yang diatur
 * dari KTD Hub (menu Aneka → Sinkron Stok + pengurangan otomatis order
 * selesai), bukan stok mentah katalog Aneka.
 *
 * Data diambil dari endpoint publik KTD Hub (GET /api/ktd-store/stok) dan
 * disimpan di state module (per worker) dengan TTL 60 detik, selaras dengan
 * cache endpoint — perubahan stok dari KTD Hub menyebar ke situs dalam
 * ±2-3 menit. Kegagalan jaringan tidak mengganggu render: stok lama (atau
 * stok katalog) tetap dipakai.
 */

const STOK_URL =
  process.env.KTD_HUB_STOK_URL ?? "https://admin.kustoro2026.com/api/ktd-store/stok";

const TTL_MS = 60 * 1000;

const state = globalThis as unknown as {
  __ktdStok?: { at: number; data: Record<string, number> };
};

/** Muat (dan cache) peta override stok dari KTD Hub. Aman dipanggil
 *  berkali-kali — panggilan berikutnya langsung lewat selama data masih
 *  segar. Dipanggil bersama muatHargaKtd (satu titik pemanggilan di tiap
 *  halaman/route). */
export async function muatStokKtd(): Promise<void> {
  const hit = state.__ktdStok;
  if (hit && Date.now() - hit.at < TTL_MS) return;
  try {
    const res = await fetch(STOK_URL, { next: { revalidate: 60 } });
    if (!res.ok) return;
    const json = (await res.json()) as { ok?: boolean; data?: Record<string, number> };
    if (!json.ok || !json.data) return;
    state.__ktdStok = { at: Date.now(), data: json.data };
  } catch {
    // Gagal jaringan — data lama (atau stok katalog) tetap dipakai.
  }
}

/** Peta override stok aktif; null bila belum pernah berhasil dimuat. */
export function petaStokKtd(): Map<string, number> | null {
  const hit = state.__ktdStok;
  if (!hit) return null;
  return new Map(Object.entries(hit.data));
}
