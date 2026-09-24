# Checklist Peluncuran Iklan Pertama — KTD Store

Centang satu per satu dari atas ke bawah. Estimasi total: 3–4 jam
(termasuk merekam video). **Jangan menayangkan iklan sebelum Fase 1 selesai
diverifikasi** — iklan tanpa tracking = uang keluar tanpa data.

## Fase 0 — Aset Meta (sekali saja)

- [ ] Meta Business Suite dibuat di business.facebook.com (email bisnis)
- [ ] Facebook Page "KTD Store" dibuat (jangan pakai profil pribadi)
- [ ] WhatsApp Business terpasang di nomor `0851 7115 7938`
- [ ] Nomor WA dihubungkan ke Meta Business (Settings → WhatsApp Accounts)
- [ ] Sapaan otomatis + quick reply diaktifkan (teks siap copy di `wa-closing.md` bagian 4)
- [ ] Pixel "KTD Store Web" dibuat di Events Manager → **Pixel ID disalin**
- [ ] Kartu pembayaran terpasang di Billing Ads Manager
- [ ] 2FA aktif di akun Meta

## Fase 1 — Tracking Website (WAJIB sebelum iklan)

- [ ] `NEXT_PUBLIC_META_PIXEL_ID` diisi di `.env.local` (untuk lokal)
- [ ] `NEXT_PUBLIC_META_PIXEL_ID` diisi di **Vercel → Settings → Environment Variables**
- [ ] **Redeploy Vercel** — tanpa ini pixel tidak muncul di produksi
- [ ] Ekstensi **Meta Pixel Helper** dipasang di Chrome
- [ ] Verifikasi di `toko.kustoro2026.com` (tunggu 2–5 menit setelah redeploy):

| # | Aksi | Event yang harus muncul di Pixel Helper |
| --- | --- | --- |
| 1 | Buka beranda | `PageView` |
| 2 | Buka halaman produk | `ViewContent` |
| 3 | Klik tombol keranjang di kartu produk | `AddToCart` |
| 4 | Buka modal checkout WhatsApp | `InitiateCheckout` |
| 5 | Kirim pesanan ke WhatsApp | `Lead` |

- [ ] Kelima baris di atas muncul → Fase 1 SELESAI

## Fase 2 — Kreatif

- [ ] 3 video demo direkam sesuai `scripts-video.md`
- [ ] 5 gambar siap upload tersedia di `creatives/` (sudah jadi, tinggal pakai)
- [ ] Teks iklan disiapkan dari `ad-copy.md` (versi A dan B per produk)
- [ ] Pesan awal WA (message template) per iklan sudah ditulis

## Fase 3 — Launch Campaign

> Semua isian field satu per satu (mulai klik "Buat Campaign" sampai tayang)
> ada di **`setup-campaign.md`** — buka dokumen itu sambil mengerjakan fase ini.

- [ ] Campaign baru dibuat: objective **Leads → WhatsApp** (CTWA)
- [ ] Nama: `KTD | CTWA | Leads | Prospek`
- [ ] Target: Indonesia · broad 18–54 · Advantage+ placements (otomatis)
- [ ] Budget harian: **Rp 60.000**
- [ ] 4 iklan dimuat (produk #1–#4 dari `ad-copy.md`): 3 video + 1 gambar
- [ ] Message template diisi di setiap iklan (contoh ada di `ad-copy.md`)
- [ ] Campaign di-submit → tunggu review Meta (biasanya < 1 jam)

## Fase 4 — Hari 1–4 (JANGAN ubah apa pun)

- [ ] Catat performa setiap hari di `reports/` (mulai dari `template-harian.csv`)
- [ ] Pantau: belanja, jumlah chat masuk, biaya per chat
- [ ] Balas setiap chat dalam < 5 menit (08.00–21.00 WIB) + jalankan follow-up (skrip di `wa-closing.md`)
- [ ] Jangan sentuh budget/targeting/kreatif — ini masa belajar algoritma

## Fase 5 — Hari ke-5 dan seterusnya

- [ ] Buka campaign retargeting Rp 15.000/hari (`strategy.md` bagian 3)
- [ ] Hari 8–10: evaluasi pertama — matikan iklan dengan CTR < 1% atau biaya/chat > Rp 35.000
- [ ] Duplikat iklan pemenang, rekam 3 video baru dengan hook berbeda
- [ ] Scale +20–30% per 2–3 hari hanya jika biaya/order < 30% margin kotor
- [ ] Evaluasi mingguan setiap Senin (lihat `reports/README.md`)
