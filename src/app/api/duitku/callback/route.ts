// SATU endpoint callback Duitku untuk semua fitur di project — pesanan toko
// (produk fisik: rumah tangga, dll) dan top-up game. Kedua alur pembayaran
// mengirim callbackUrl yang sama ke sini; router mengecek ref_id ke tabel
// store_orders lalu topup_orders dan menjalankan handler yang cocok.
//
// URL ini yang dicantumkan sebagai Callback URL proyek:
//   https://toko.kustoro2026.com/api/duitku/callback

import { routeDuitkuCallback } from "@/lib/duitku-callback";

export const runtime = "nodejs";

// Eksekusi top-up berjalan INLINE di callback ini — loop retry Lapis 1 (3x
// percobaan + jeda) butuh sampai ~10 detik, jadi batas Vercel default 10 dtk
// dinaikkan (Hobby maksimal 60 dtk).
export const maxDuration = 30;

export async function POST(req: Request) {
  return routeDuitkuCallback(await req.text());
}
