// SATU endpoint callback Duitku untuk semua fitur di project — pesanan toko
// (produk fisik: rumah tangga, dll) dan top-up game. Kedua alur pembayaran
// mengirim callbackUrl yang sama ke sini; router mengecek ref_id ke tabel
// store_orders lalu topup_orders dan menjalankan handler yang cocok.
//
// URL ini yang dicantumkan sebagai Callback URL proyek:
//   https://toko.kustoro2026.com/api/duitku/callback

import { routeDuitkuCallback } from "@/lib/duitku-callback";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return routeDuitkuCallback(await req.text());
}
