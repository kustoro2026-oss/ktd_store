// Webhook callback Duitku untuk top-up — kini mendelegasikan ke router
// terpadu /api/duitku/callback (src/lib/duitku-callback.ts) yang menangani
// SEMUA fitur (pesanan toko + top-up). Endpoint ini tetap dipertahankan agar
// transaksi lama yang sudah mengirim callbackUrl ke sini tidak terlewat.
//
// Alur: verifikasi signature → cocokkan merchantOrderId (= ref_id) ke
// pesanan → tandai dibayar → eksekusi otomatis (cek saldo → transaksi
// Digiflazz → WA). Eksekusi idempoten — claim atomik di db.ts mencegah
// transaksi ganda bila Duitku retry. Setelah itu, jalankan cek ulang Pending
// di latar belakang (after) sebagai tick kesempatan kedua (cron Vercel Hobby
// hanya 1x/hari).

import { routeDuitkuCallback } from "@/lib/duitku-callback";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return routeDuitkuCallback(await req.text());
}
