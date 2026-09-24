# Meta Ads — KTD Store

Paket iklan Meta (Facebook & Instagram) untuk **toko.kustoro2026.com**.
Disusun untuk model bisnis toko ini: **order via WhatsApp + COD/Transfer**, dengan
tambahan penjualan lewat Blibli, TikTok Shop, dan Lazada.

## Struktur Folder

Semua hal Meta Ads terpusat di folder ini:

```
meta-ads/
├── README.md            ← panduan setup (file ini)
├── checklist-luncur.md  ← checklist peluncuran — centang satu per satu
├── setup-campaign.md    ← isian field-by-field Ads Manager (buat campaign s.d. tayang)
├── strategy.md          ← strategi campaign: struktur, targeting, budget, KPI
├── ad-copy.md           ← copy iklan siap pakai per produk + aturan policy
├── scripts-video.md     ← naskah & shot list video demo untuk direkam
├── wa-closing.md        ← panduan closing chat WA — solusi "chat tidak jadi order"
├── creatives/           ← 5 visual iklan siap upload (4:5)
└── reports/             ← pencatatan performa harian (template CSV + panduan)
```

**Urutan pemakaian:** `checklist-luncur.md` (ikuti langkahnya) →
`setup-campaign.md` (sambil mengisi Ads Manager, buka ini) → `ad-copy.md` +
`creatives/` + `scripts-video.md` (materi iklan) → `wa-closing.md` (saat chat
mulai masuk) → `strategy.md` (pahami strategi & evaluasi) → `reports/`
(setelah iklan jalan).

> Kode tracking (`src/lib/meta-pixel.ts`, `src/components/MetaPixel.tsx`, dan
> pemanggilan event di komponen lain) tetap berada di `src/` karena dibundel
> oleh aplikasi Next.js — detailnya di Bagian 1 di bawah.

---

## Bagian 1 — Tracking yang Sudah Terpasang di Kode

Tracking Meta Pixel sudah terpasang di website dan **nonaktif secara aman**
sampai Pixel ID dimasukkan (tidak akan error walau dibiarkan kosong).

| Event | Kapan Dikirim | File |
| --- | --- | --- |
| `PageView` | Semua halaman + navigasi SPA | `src/components/MetaPixel.tsx` |
| `ViewContent` | Halaman detail produk dibuka | `src/components/ProductDetailView.tsx` |
| `AddToCart` | Produk masuk keranjang | `src/lib/cart.tsx` |
| `InitiateCheckout` | Modal checkout WhatsApp dibuka | `src/components/WhatsAppOrderModal.tsx` |
| `Lead` | Pesanan terkirim ke WhatsApp | `src/components/WhatsAppOrderModal.tsx` |
| `Contact` | Pembeli klik "Tanya Admin via WA" | `src/components/WhatsAppOrderModal.tsx` |
| `MarketplaceClick` (kustom) | Pembeli klik tombol beli Blibli / TikTok Shop / Lazada | `src/components/ProductDetailView.tsx`, `src/app/keranjang/page.tsx` |

Event `MarketplaceClick` dikirim sebagai event **kustom** (`fbq("trackCustom", ...)`)
karena Meta tidak punya event standar untuk klik-keluar ke marketplace. Di
Events Manager ia muncul di grup Custom Events dan bisa dipakai sebagai Custom
Conversion / audiens retargeting (mis. "tertarik tapi beli di marketplace").
Parameter yang dikirim: `marketplace` (blibli/tiktok/lazada), `content_ids`,
`content_name`, `value`, `currency`. Event hanya dikirim bila link produk di
marketplace itu benar-benar ada (kalau tidak, muncul MarketplaceNotice).

Semua event mengirim parameter standar Meta: `content_ids`, `content_name`,
`value` (dalam Rupiah), `currency: "IDR"`.

> **Catatan penting:** `Lead` adalah konversi utama situs ini (order via WA).
> Untuk campaign *Click-to-WhatsApp*, Meta juga menghitung konversi langsung
> dari percakapan WhatsApp — event pixel melengkapinya untuk retargeting.

---

## Bagian 2 — Setup Akun Meta (sekali saja, ± 1 jam)

Kerjakan berurutan. Semua gratis — yang berbayar hanya budget iklannya.

1. **Buat Meta Business Suite** di https://business.facebook.com
   - Gunakan email bisnis (bukan email pribadi lama), isi nama bisnis: `KTD Store`.
2. **Buat Facebook Page** `KTD Store`
   - Halaman wajib ada untuk beriklan. Follower tidak penting di awal.
   - Jangan pakai profil pribadi untuk beriklan.
   - Opsional: hubungkan Instagram akun toko supaya bisa tayang di IG juga.
3. **Hubungkan WhatsApp Business**
   - Install **WhatsApp Business** (gratis) di nomor toko: `0851 7115 7938`.
   - Di Meta Business Suite → Settings → Accounts → WhatsApp Accounts → hubungkan nomor.
   - Aktifkan: sapaan otomatis ("Halo! Terima kasih sudah menghubungi KTD Store...")
     dan quick replies (lihat template di `strategy.md`).
   - **Wajib untuk campaign Click-to-WhatsApp** — inilah sumber orderan utama.
4. **Buat Pixel**
   - Buka **Events Manager** → Data Sources → `+ Connect data` → Web.
   - Nama pixel: `KTD Store Web` → salin **Pixel ID** (15–16 digit angka).
5. **Metode pembayaran iklan**
   - Masukkan kartu kredit/debit di Billing & Payments. Tagihan muncul tiap
     ambang tertentu (mis. Rp 300rb–500rb) atau akhir bulan.
6. **Amankan akun**
   - Aktifkan 2FA di Business Manager; jangan beri akses Admin ke pihak luar.

## Bagian 3 — Pasang Pixel ID (5 menit)

**Di komputer (development):** sudah disiapkan di `.env.local`:

```
NEXT_PUBLIC_META_PIXEL_ID=   ← isi dengan ID pixel Anda
```

**Di production (Vercel) — WAJIB, kalau tidak iklan tetap "buta":**

1. Vercel Dashboard → project → **Settings → Environment Variables**
2. Tambah: `NEXT_PUBLIC_META_PIXEL_ID` = (ID pixel), environment: Production (+ Preview opsional)
3. **Redeploy** — variabel `NEXT_PUBLIC_*` ditanam saat build, jadi tanpa
   redeploy tracking tidak akan muncul.

## Bagian 4 — Verifikasi Tracking (sebelum keluar uang iklan)

1. Install ekstensi Chrome **Meta Pixel Helper**.
2. Buka `toko.kustoro2026.com`, lalu cek berurutan:

| Aksi di situs | Event yang harus muncul |
| --- | --- |
| Buka beranda | `PageView` |
| Buka salah satu produk | `ViewContent` |
| Klik ikon keranjang di kartu produk | `AddToCart` |
| Isi checkout → klik pesan (sebelum klik kirim WhatsApp) | `InitiateCheckout` |
| Klik "Buat Pesanan via WhatsApp" | `Lead` |

3. Alternatif: Events Manager → **Test Events** (event tampil real-time).
4. Tunggu 2–5 menit setelah redeploy sebelum menyimpulkan "tidak jalan".

## Bagian 5 — Menjalankan Campaign Pertama

Ringkasan (detail lengkap + angka budget di `strategy.md`):

1. **Campaign utama — Click-to-WhatsApp (CTWA)**
   - Ads Manager → `+ Create` → Objective: **Leads** → Konversi: **WhatsApp**.
   - Target: Indonesia (broad), usia mengikuti produk (lihat `strategy.md`).
   - 3–4 iklan dalam 1 ad set: kombinasi video demo + gambar.
2. **Campaign retargeting** (setelah pixel terkumpul 1–2 minggu)
   - Audiens: pengunjung situs 90 hari + yang `AddToCart`/`InitiateCheckout`.
   - Objective: Traffic/Sales ke halaman produk.
3. **Budget mulai: Rp 75.000/hari** (rekomendasi; rincian di `strategy.md`).

## Bagian 6 — Produk yang BOLEH vs JANGAN Diiklankan

Meta punya daftar kebijakan iklan. Ringkas untuk katalog KTD Store:

| Aman diiklankan | Risiko ditolak — jangan diiklankan dulu |
| --- | --- |
| Pembersih rumah tangga (Glow Home semua varian) | Produk "herbal pria dewasa" (4G Lucky Spray, Tiga Jari Oil, Wamena Oil) → kategori Kesehatan Seksual/Dewasa |
| Alat rumah tangga, dapur (Asahan Pisau, dll.) | Suplemen dengan klaim penyakit (mis. "penghancur batu ginjal") |
| Pertanian & perikanan (Fertani, pupuk, paranet) | Obat/krim dengan klaim menyembuhkan |
| Fashion, aksesoris | Produk dengan gambar sebelum/sesudah ekstrem |

Aturan klaim (penting, sekaligus melindungi akun iklan):

- Tulis manfaat faktual produk; **jangan** "100% ampuh", "nomor 1", "termurah".
- **Jangan** menyerang kondisi pribadi pembaca ("Kamu punya masalah WC mampet?"
  → tulis "Solusi WC mampet tanpa sedot").
- **Jangan** klaim kesehatan berlebihan; itu domain BPOM/iklan kesehatan.

## Bagian 7 — Troubleshooting Umum

| Masalah | Penyebab & solusi |
| --- | --- |
| Iklan ditolak | Baca pesan policy; biasanya klaim berlebihan / gambar "berlebihan". Ganti 1 variabel lalu submit ulang. Jangan buat akun baru. |
| Pixel tidak terdeteksi | Belum redeploy Vercel, ID salah, atau pemblokir iklan di browser Anda. Cek dengan Pixel Helper di Chrome biasa. |
| Biaya per chat mahal | 90% masalahnya di kreatif, bukan targeting. Ganti hook 3 detik pertama video / ganti gambar. |
| Hasil buka-tutup (naik-turun) | Normal di hari 1–3 per ad set (learning phase). Jangan ubah apa pun minimal 3–4 hari atau sampai ± 50 hasil. |
| WA kebanjiran chat kosong | Pasang sapaan otomatis + quick reply; pertanyaan pertama selalu "Mau pesan produk apa, Kak?" dengan balasan template. |

---

*Semua angka harga di dokumen materi iklan mengacu data katalog per September
2026 — cek ulang harga & stok di situs sebelum menayangkan iklan.*
