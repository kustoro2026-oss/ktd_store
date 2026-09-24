# Laporan Performa Iklan — KTD Store

Folder ini untuk mencatat hasil iklan setiap hari. **Ini bagian terpenting
yang sering dilupakan** — data Ads Manager saja tidak cukup; pencatatan manual
membuat Anda tahu persis chat mana yang jadi order (karena order terjadi di
WhatsApp, di luar jangkauan Meta).

## Cara Pakai

1. Salin `template-harian.csv` → ganti nama jadi `laporan-YYYY-MM.csv`
   (contoh: `laporan-2026-09.csv`). Satu file per bulan.
2. Isi satu baris **setiap hari** setelah belanja iklan berjalan (isi jam malam).
3. Angka belanja, tayangan, klik, CTR diambil dari Ads Manager
   (kolom: Amount spent, Impressions, Link clicks, CTR).
4. **Chat Masuk** = jumlah orang yang benar-benar mengirim pesan dari iklan
   (lihat di Ads Manager hasil "New messaging conversations" atau hitung manual).
5. **Order** dan **Omzet** = hitung sendiri dari chat yang closing —
   inilah keunggulan pencatatan manual: akurat per iklan.
6. Kolom "Biaya per Chat" dan "Biaya per Order" bisa dibiarkan kosong lalu
   dibuat formula Excel:
   - Biaya per Chat = `Belanja / Chat Masuk`
   - Biaya per Order = `Belanja / Order` (isi "-" jika order 0)

> File CSV ini memakai pemisah **titik-koma (;)** agar terbuka rapi langsung
> di Excel versi Indonesia. Bisa juga di-import ke Google Sheets
> (File → Import → pilih pemisah titik-koma).

## Agenda Evaluasi

### Harian (2 menit)
- Isi satu baris di CSV.
- Cek cepat: ada chat masuk hari ini? Ada yang belum dibalas?

### Hari ke-4 (setelah learning phase)
- Lihat tren: biaya per chat naik atau turun?
- Jangan ubah apa pun sebelum evaluasi pertama ini.

### Evaluasi pertama (hari 8–10)
- Iklan dengan **CTR < 1%** atau **biaya/chat > Rp 35.000** → matikan.
- Iklan dengan hasil terbaik → duplikat + tambah budget pelan-pelan.

### Mingguan (setiap Senin)
- Hitung total minggu: total belanja vs total omzet dari iklan.
- **Biaya per order mingguan < 30% margin kotor?** → scale +20–30%.
- Tidak? → ganti kreatif dulu (hook baru), budget jangan dinaikkan.

### Bulanan
- Bandingkan `laporan-YYYY-MM.csv` dengan bulan lalu.
- Putuskan: produk baru yang masuk bank iklan, produk yang diistirahatkan.
