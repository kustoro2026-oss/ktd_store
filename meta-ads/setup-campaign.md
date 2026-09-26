# Panduan Isi Setting Ads Manager — dari Klik "Buat" sampai Iklan Tayang

Dokumen ini memandu mengisi **SETIAP field** saat membuat campaign di Meta Ads
Manager: urut dari Campaign → Ad Set → Iklan → Publish.

**Perkiraan waktu:** 20–30 menit untuk Campaign A (CTWA), 10 menit untuk Campaign B, 10 menit untuk Campaign C (opsional).

> Catatan: nama field di UI Meta bisa tampil Bahasa Indonesia atau Inggris
> tergantung setelan bahasa akun — kedua nama ditulis di tabel. Posisi field
> bisa bergeser sedikit antar versi, urutannya tetap sama.

**Alur besar: 1 Campaign → 1 Ad Set → 4 Iklan.**

---

## BAGIAN A — Campaign CTWA (sumber orderan utama)

### A1. Mulai

1. Buka https://adsmanager.facebook.com
2. Pastikan di kiri atas sudah terpilih: akun iklan KTD Store.
3. Klik tombol **+ Buat / + Create** (hijau).
4. Muncul layar pemilihan *objective* (tujuan) → lanjut ke A2.

### A2. Level Campaign (halaman 1 — hanya ± 4 isian)

| Field | Yang diisi | Catatan |
| --- | --- | --- |
| Objective / Tujuan | **Leads (Prospek)** | Jangan pilih Sales/Traffic |
| Conversion location / Lokasi konversi | **WhatsApp** | Muncul di bawah objective. Kalau tidak terlihat di sini, ia muncul di level Ad Set — intinya sama |
| Campaign name / Nama campaign | `KTD \| CTWA \| Leads \| Prospek` | Pakai persis supaya laporan mudah dibaca |
| Advantage campaign budget | **OFF** (biarkan mati) | Budget diisi di level Ad Set (A3) |
| Special ad categories / Kategori iklan khusus | **None / Tidak ada** | Produk kita tidak masuk kategori khusus |
| A/B test | Lewati / skip | Tidak sekarang |
| Buying type | Auction (default) | Biarkan |

Klik **Next / Lanjutkan**.

### A3. Level Ad Set (halaman 2 — bagian terpenting)

**Blok "Conversion / Konversi":**

| Field | Yang diisi | Catatan |
| --- | --- | --- |
| WhatsApp account | Pilih nomor `0851 7115 7938` | Kalau kosong/tidak muncul: nomor belum terhubung ke Business Manager → ulangi README Bagian 2 langkah 3 |
| Performance goal / Tujuan performa | **Maximize number of conversations** (Maksimalkan jumlah percakapan) | Satu-satunya pilihan yang benar untuk CTWA |

**Blok "Budget & Schedule / Budget dan Jadwal":**

| Field | Yang diisi | Catatan |
| --- | --- | --- |
| Budget | **Harian Rp 60.000** | Jangan lebih kecil saat uji coba |
| Jadwal | Mulai hari ini, **tanpa tanggal selesai** | "Berjalan terus" |
| Bid strategy / Strategi penawaran | **Highest volume / Volume tertinggi** (dulu "Lowest cost") | Jangan pilih Cost per result goal dulu |

**Blok "Audience / Audiens":**

| Field | Yang diisi | Catatan |
| --- | --- | --- |
| Location / Lokasi | **Indonesia** | Hapus filter lain bila ada (mis. "Orang yang tinggal di area ini") |
| Age / Usia | **18–54** | Untuk produk rumah tangga boleh 21–54 |
| Gender | **Semua** | |
| Detailed targeting / Target minat | **KOSONGKAN (broad)** | Biarkan Meta yang mencari pembeli; jangan diisi minat dulu |
| Advantage audience | **ON** (biarkan default) | |
| Language / Bahasa | Biarkan default | Kalau ada pilihan: Indonesia + English |

**Blok "Placements / Penempatan":**

| Field | Yang diisi | Catatan |
| --- | --- | --- |
| Placements | **Advantage+ placements** (otomatis/default) | Jangan pilih manual di fase uji |

Klik **Next / Lanjutkan**.

### A4. Level Iklan (halaman 3 — ulangi 4×)

Klik **"+ Tambah iklan / Add ad"** untuk tiap iklan. Isian tiap iklan:

**Blok "Identity / Identitas":**

| Field | Yang diisi |
| --- | --- |
| Facebook Page | **KTD Store** |
| Instagram account | Akun IG toko bila sudah terhubung; kalau belum biarkan default |

**Blok "Creative / Kreatif":**

| Field | Yang diisi |
| --- | --- |
| Format | Single image or video |
| Media | Upload sesuai tabel di bawah |
| Primary text / Teks utama | Salin dari **`ad-copy.md`** (versi A; simpan versi B untuk variasi nanti) |
| Headline / Judul | Salin dari `ad-copy.md` |
| Description / Deskripsi | Salin dari `ad-copy.md` |

**Blok "Destination / Tujuan":**

| Field | Yang diisi |
| --- | --- |
| Destination | WhatsApp (otomatis terisi dari campaign) → pilih nomor `0851 7115 7938` |
| CTA button | **Otomatis "Send Message / Kirim Pesan"** (tidak bisa diganti — beginilah CTWA) |
| Message template / Templat pesan | Isi dengan "pesan awal WA" milik produk ini dari `ad-copy.md` |
| URL parameters | **Kosongkan** (tidak berlaku untuk CTWA) |

**4 iklan yang dimuat:**

| # | Nama iklan (Ad name) | Media | Copy (dari ad-copy.md) |
| --- | --- | --- | --- |
| 1 | `VideoDemo \| GlowFoam \| v1` | Video 9:16 (dari `scripts-video.md`) atau gambar `creatives/01-glowhome-toilet.png` | Iklan 1 |
| 2 | `VideoDemo \| BubukAjaib \| v1` | Video 9:16 atau gambar `creatives/02-bubuk-ajaib.png` | Iklan 2 |
| 3 | `VideoDemo \| AsahanPisau \| v1` | Video 9:16 atau gambar `creatives/03-asahan-pisau.png` | Iklan 3 |
| 4 | `Image \| Fertani \| v1` | Gambar `creatives/04-fertani-ikan.png` | Iklan 4 |

Biarkan semua pengaturan **Advantage+ creative / penyempurnaan kreatif = default**.

### A5. Review & Publish

1. Klik **Publish / Publikasikan**.
2. Baca ringkasan yang muncul → konfirmasi.
3. Status iklan jadi **"In review / Dalam peninjauan"**.
4. Biasanya aktif **< 1 jam** (maksimal 24 jam). Biarkan saja, tidak perlu diapa-apakan.
5. **Kalau ada iklan ditolak:** baca alasan yang dikirim Meta, cek tabel
   "Jangan tulis / Tulis begini" di `ad-copy.md`, perbaiki 1 hal lalu submit ulang.
   Jangan buat akun baru.

---

## BAGIAN B — Campaign Retargeting (buat hari ke-5, bukan sekarang)

### B1. Buat 3 Custom Audience dulu (menu "Audiences / Audiens")

Buka Ads Manager → menu **Audiences** → **Create audience → Custom audience → Website**.

| Nama audiens | Pixel | Event & kondisi |
| --- | --- | --- |
| `KT - Interaksi Produk 14d` | KTD Store Web | `AddToCart` **OR** `InitiateCheckout` · dalam 14 hari |
| `KT - Lihat Produk 30d` | KTD Store Web | `ViewContent` · dalam 30 hari |
| `KT - Sudah Order 30d` | KTD Store Web | `Lead` · dalam 30 hari (untuk **dikecualikan**, bukan ditarget) |

> Kalau ukuran audiens masih kecil (< 1.000 orang), tunggu sampai pixel
> terkumpul lebih banyak — retargeting yang terlalu kecil boros dan cepat lelah.
> Pantau dari kolom Size di daftar audiens.
>
> Bonus (opsional): cek juga Audiences → Engagement — jika ada sumber
> WhatsApp/Messaging, buat `KT - Pernah Chat` untuk CTWA kedua (angle
> testimoni) bagi yang pernah chat tapi belum order — lihat `wa-closing.md` bagian 7.

### B2. Isian Campaign Retargeting

| Level | Field | Yang diisi |
| --- | --- | --- |
| Campaign | Objective | **Traffic (Trafik)** |
| Campaign | Nama | `KTD \| Traffic \| Retargeting \| Pixel` |
| Ad Set | Conversion location | **Website** |
| Ad Set | Performance goal | **Maximize number of landing page views** |
| Ad Set | Budget | **Harian Rp 15.000** |
| Ad Set | Audience | **Include:** `KT - Interaksi Produk 14d` + `KT - Lihat Produk 30d` · **Exclude:** `KT - Sudah Order 30d` |
| Ad Set | Lokasi/usia/gender | Indonesia · 18–54 · semua (sama seperti A3) |
| Ad Set | Placements | Advantage+ (default) |
| Iklan | Copy | Bagian **Bundling** di `ad-copy.md` (toilet Rp 92.000 / mesin cuci Rp 80.000) |
| Iklan | Destination | **Website URL** — pakai tautan + UTM yang sudah disediakan di `ad-copy.md` |
| Iklan | CTA button | **Beli sekarang / Shop Now** (atau "Selengkapnya/Learn more") |

---

## BAGIAN C — Campaign Traffic ke Situs: "model pilih channel"

> **Dijalankan sebagai campaign pertama (keputusan 25 Sep 2026).** CTWA
> (Bagian A) ditunda dan bisa ditambahkan kapan saja. Alur: iklan angle promo
> → halaman produk di situs → pembeli pilih sendiri: tombol WA (COD) atau
> tombol marketplace resmi.

| Level | Field | Yang diisi |
| --- | --- | --- |
| Campaign | Objective | **Traffic (Trafik)** |
| Campaign | Nama | `KTD \| Traffic \| Promo \| Situs` |
| Ad Set | Conversion location | **Website** |
| Ad Set | Performance goal | **Maximize number of landing page views** |
| Ad Set | Budget | **Rp 30.000/hari** (diterapkan 25 Sep 2026; evaluasi 10–14 hari, naik bertahap bila terbukti) |
| Ad Set | Audience | Indonesia · 18–54 · semua (broad, sama seperti A3) |
| Ad Set | Placements | Advantage+ (default) |
| Iklan | Media | kreatif produk promo (video 9:16 / gambar dari `creatives/`) |
| Iklan | Primary text | dari `ad-copy.md` + sisipkan kalimat "Ambil harga promo" |
| Iklan | Destination | **Website URL:** `https://toko.kustoro2026.com/produk/<id>?utm_source=facebook&utm_medium=paid&utm_campaign=ktd-traffic-situs&utm_content=<nama-iklan>` |
| Iklan | CTA button | **Belanja sekarang / Shop Now** |

> **Kreatif terpasang (25 Sep 2026):** video demo 14 dtk via **"Gunakan
> postingan yang ada"** — postingan KTD Store 24 Sep, social proof (44
> bagikan) ikut terbawa; mode ini tidak menyediakan field Judul/Deskripsi.
> Menerbitkan perubahan materi lewat "Tinjau Item Konsep" memicu review ulang
> singkat (status "Sedang Ditinjau") — normal.

> Hasil campaign ini diukur dari: (1) jumlah kunjungan situs (kolom Meta),
> (2) chat/order WA yang masuk dari pengunjung situs, (3) kenaikan penjualan
> marketplace dari Seller Center. Konversi akhir di marketplace tidak terlihat
> pixel — itu batas alaminya, bukan kerusakan.
>
> Landing memakai **halaman produk yang sudah ada** (keputusan) — halaman
> `/promo` khusus ditunda sampai ada kebutuhan campaign event. Pastikan iklan
> menampilkan produk yang sama dengan halaman tujuannya.

## BAGIAN D — Setelah Publish (hari 1–4)

| Pertanyaan | Jawaban |
| --- | --- |
| Cek status di mana? | Kolom **Delivery / Penayangan** — harus tertulis "Active/Aktif" (hijau) |
| Hasilnya dilihat di kolom apa? | Campaign **Traffic aktif**: **Results / Hasil** = "Tayangan Halaman Tujuan" + **Amount spent / Jumlah belanja**. Untuk CTWA nanti: "New messaging conversations" |
| Boleh ubah budget/targeting? | **TIDAK** selama 3–4 hari pertama (learning phase) |
| Yang perlu dilakukan? | Balas tiap chat WA < 5 menit · isi log harian di `reports/` |
| Kapan evaluasi pertama? | Hari 8–10 — aturan kill/scale ada di `strategy.md` Bagian 6 |

---

## Lampiran — Semua Isian Campaign A dalam 1 Halaman (untuk dicetak)

```
CAMPAIGN
  Objective ............. Leads → Conversion location: WhatsApp
  Nama .................. KTD | CTWA | Leads | Prospek
  Budget campaign ....... OFF (diisi di Ad Set)
  Kategori khusus ....... Tidak ada

AD SET
  Akun WhatsApp ......... 0851 7115 7938
  Tujuan performa ....... Maksimalkan jumlah percakapan
  Budget ................ Rp 60.000 / hari, tanpa akhir
  Strategi penawaran .... Volume tertinggi
  Lokasi ................ Indonesia
  Usia / Gender ......... 18–54 / Semua
  Target minat .......... Kosong (broad)
  Penempatan ............ Advantage+ (otomatis)

IKLAN (4×)
  Page .................. KTD Store
  Format ................ Single image or video
  Media ................. video 9:16 (produk 1–3) / gambar 4:5 produk 4
  Teks .................. salin dari ad-copy.md
  Template pesan WA ..... sesuai produk di ad-copy.md
  Nama iklan ............ VideoDemo | [Produk] | v1
```
