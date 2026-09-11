// Cache detail produk anekadropship (in-memory, TTL 5 menit) supaya halaman
// produk dan API ongkir tidak melakukan double-scrape halaman detail yang sama.
// Catatan: objek yang dikembalikan TIDAK boleh dimutasi — dipakai bersama.
import { anekaClient, type AnekaProductDetail } from "./anekadropship";

const cache = new Map<string, { data: AnekaProductDetail; ts: number }>();
const TTL = 5 * 60_000; // 5 minutes

/** Ambil detail produk (dengan cache). null jika produk gagal di-scrape. */
export async function getDetailCached(id: string): Promise<AnekaProductDetail | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;
  try {
    const detail = await anekaClient.getProductDetail(id);
    cache.set(id, { data: detail, ts: Date.now() });
    return detail;
  } catch {
    return null;
  }
}
