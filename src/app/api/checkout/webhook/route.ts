// Webhook callback Duitku untuk pesanan toko — kini mendelegasikan ke router
// terpadu /api/duitku/callback (src/lib/duitku-callback.ts) yang menangani
// SEMUA fitur (pesanan toko + top-up). Endpoint ini tetap dipertahankan agar
// transaksi lama yang sudah mengirim callbackUrl ke sini tidak terlewat.
//
// Alur: verifikasi signature → cocokkan merchantOrderId (= ref_id) → tandai
// lunas → NOTIFIKASI OTOMATIS ke WA bot: pemilik menerima detail pesanan
// lengkap (produk, alamat, kurir, total, bukti bayar berupa reference
// Duitku) tanpa pembeli perlu mengirim bukti transfer manual.

import { routeDuitkuCallback } from "@/lib/duitku-callback";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return routeDuitkuCallback(await req.text());
}
