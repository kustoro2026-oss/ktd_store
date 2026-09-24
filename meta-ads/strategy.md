# Strategi Meta Ads — KTD Store

Dokumen kerja untuk mengiklankan **toko.kustoro2026.com** di Facebook & Instagram.
Tujuan utama: **orderan masuk via WhatsApp secara konsisten dan terukur**.

---

## 1. Model Bisnis → Implikasi Strategi

| Karakter toko | Implikasi ke iklan |
| --- | --- |
| Order via WhatsApp (bukan checkout di situs) | Kampanye utama = **Click-to-WhatsApp (CTWA)**. Meta mengoptimalkan orang yang benar-benar memulai chat. |
| Pembayaran COD / transfer bank | COD adalah **selling point utama** untuk audiens yang belum percaya toko online → masuk ke semua copy. |
| 707 produk lintas kategori | Jangan iklankan semua. Pilih 3–5 produk "pahlawan" (problem-solver, visual demo, harga impulse). |
| Harga Rp 14.000–229.000 | Sweet spot iklan: Rp 20.000–60.000 (keputusan beli cepat) + 1 produk premium untuk retargeting. |
| Website statis + pixel baru dipasang | Retargeting baru efektif setelah 1–2 minggu data terkumpul. Fase awal fokus prospek baru. |

**Strategi besar:** two-track — (A) *prospecting* via CTWA untuk orderan baru,
(B) *retargeting* pengunjung situs yang belum order lewat pixel yang sudah terpasang.

### Arah Iklan: WhatsApp vs Website — Pembagian Peran

Keputusan: **pembeli baru selalu diarahkan ke WhatsApp (CTWA); website dipakai
untuk retargeting & kredibilitas.** Alasannya spesifik untuk toko ini:

| Faktor | Arah WA (CTWA) | Arah Website |
| --- | --- | --- |
| Alur order | Langsung ke tempat order → 1 langkah | Situs **tidak punya checkout mandiri** — order tetap berakhir di WA, jadi ada 2–3 langkah tambahan menuju tujuan yang sama |
| Optimasi Meta | Bisa optimal sejak hari 1 (percakapan = konversi) | Baru kuat setelah pixel terkumpul 1–2 minggu |
| Closing | Admin bisa menjawab keraguan, tawarkan bundling, dorong keputusan | Pembeli browsing sendiri; tanpa chat tidak ada yang menutup penjualan |
| Kepercayaan | Wajar & lumrah di pasar Indonesia; negosiasi COD via chat | Membantu pembeli "memeriksa" harga & stok sebelum chat |
| Peran situs | — | Kredibilitas (harga & stok transparan), bahan audiens retargeting pixel, SEO, pusat tautan marketplace, dan tujuan iklan retargeting |

Praktiknya: tautan halaman produk tetap dipakai **di dalam percakapan WA** —
admin mengirim link agar pembeli melihat stok real-time & menghitung ongkir
sendiri. Jadi website bukan ditinggalkan: website adalah alat closing di dalam
chat + medan retargeting. Jika suatu saat situs punya pembayaran langsung
(payment gateway), barulah campaign Sales langsung ke website masuk hitungan.

### Posisi Marketplace (Blibli, TikTok Shop, Lazada) di Strategi Iklan

Situs sudah punya tombol "Beli di marketplace resmi" di bawah tombol WhatsApp —
urutan ini sudah benar dan **jangan diubah**. Tiga aturan untuk iklan:

1. **Iklan Meta TIDAK PERNAH diarahkan ke halaman marketplace.** Tidak ada
   pixel di halaman Blibli/TikTok/Lazada — Meta jadi buta dan tidak bisa
   mengoptimalkan; ditambah Anda membayar komisi marketplace + biaya klik Meta
   sekaligus, dan relasi pelanggan (nomor WA, order ulang) hilang. TikTok Shop
   paling parah: pembeli dari Meta harus buka app TikTok + login dulu sebelum
   beli — drop-off besar.
2. **Tombol marketplace di situs = fitur, bukan kebocoran.** Biarkan tetap ada
   (WA tetap tombol utama). Untuk campaign retargeting yang mendarat di situs,
   memberi pilihan justru menaikkan konversi — pembeli membeli lewat channel
   yang ia percaya; tetap ada penjualan daripada tidak.
3. **Untuk pertumbuhan di marketplace, pakai alat iklan internal masing-masing**
   (Blibli Ads, Lazada Sponsored, TikTok GMV Max), bukan Meta. Pembagian:
   Meta = channel sendiri (WA & situs); alat internal = listing marketplace.

Jika pembeli dari chat WA bertanya "bisa beli via Blibli/TikTok Shop?" →
layani, dan sampaikan harga di marketplace bisa sedikit berbeda karena biaya
layanan platform.

---

## 2. Rekomendasi Budget (Anda belum menentukan)

### Fase uji coba — 2 minggu pertama (WAJIB, jangan lebih kecil)

| Pos | Budget/hari | Fungsi |
| --- | --- | --- |
| Campaign A — CTWA Prospek Baru | **Rp 60.000** | Sumber orderan utama; 1 ad set, 4 iklan (3 produk + 1 varian kreatif) |
| Campaign B — Retargeting (mulai hari ke-5) | **Rp 15.000** | Menjemput yang sudah lihat produk / isi checkout tapi belum order |
| **Total** | **Rp 75.000/hari** | ± **Rp 1.050.000** untuk 14 hari uji coba |

Kenapa tidak lebih kecil: di bawah ±Rp 50.000/hari, satu campaign sulit
meninggalkan *learning phase* — hasilnya lambat dan data tidak cukup untuk
memutuskan produk pemenang.

### Fase scaling — setelah ada produk pemenang (minggu 3+)

- Jika **biaya per order < 30% margin kotor per order** → scale budget
  **+20–30% setiap 2–3 hari** (jangan loncat 2×, algoritma reset).
- Target realistis bulan pertama: **Rp 100.000–150.000/hari** dengan
  2–4 order/hari dari iklan.
- Plafon sehat fase ini: Rp 300.000/hari — hanya jika ROAS ≥ 3 konsisten 2 minggu.

---

## 3. Struktur Campaign (Ads Manager)

### Campaign A — Prospek Baru (CTWA)

```
KTD | CTWA | Leads | Prospek
└── Ad Set: ID - Broad - 18-54 - Semua Penempatan
    ├── Iklan 1: GlowHome Foam Toilet — video demo
    ├── Iklan 2: Bubuk Ajaib Anti Sumbat — video demo
    ├── Iklan 3: Asahan Pisau Mini — video demo
    └── Iklan 4: Fertani Penggemuk Ikan — gambar/video
```

- **Objective:** Leads → konversi **WhatsApp** (bukan "Sales"/pixel).
- **Optimasi:** Maximize number of conversations · bidding Lowest Cost.
- **Penempatan:** Advantage+ placements (otomatis). Reels & Feed = mayoritas hasil.
- **Catatan:** biarkan 1 ad set dulu. Jangan pecah per produk di awal —
  biarkan Meta memilih iklan terbaik dari 4 yang tersedia.

### Campaign B — Retargeting (buka hari ke-5, setelah pixel ada data)

```
KTD | Traffic | Retargeting | Pixel
└── Ad Set: Pengunjung 30 hari (tanpa pembelian)
    ├── Audiens 1: AddToCart / InitiateCheckout 14 hari  ← prioritas tertinggi
    └── Audiens 2: View Content 30 hari + pengunjung situs
```

- **Objective:** Traffic (arahkan ke halaman produk di situs).
- Iklan berisi penawaran "penutup": testimoni/ulasan, jawaban keraguan
  ("stok ready", "COD bisa", "ongkir real-time"), plus bundling lebih hemat.
- Frekuensi dijaga < 4×/minggu per orang; ganti kreatif jika lelah.

### Campaign C — Traffic ke Situs: "model pilih channel" (opsional, buka setelah A & B stabil)

Alur: **Iklan (angle "Ambil Promo") → halaman produk di situs → pembeli pilih
sendiri: tombol WA (COD) atau tombol marketplace resmi → closing.**

```
KTD | Traffic | Promo | Situs
└── Ad Set: ID - Broad - 18-54 (dingin, tanpa audiens khusus)
    ├── Iklan: produk promo unggulan (copy angle harga promo)
    └── Destination: halaman produk di situs + UTM
```

- **Fungsinya:** menangkap pembeli yang *hanya percaya marketplace* (mereka
  tidak mau chat dulu). Perantara halaman produk tetap mencatat pixel
  (`ViewContent`) sehingga audiens retargeting ikut tumbuh.
- **Sadari batasnya:** konversi akhir di marketplace TIDAK terlihat pixel —
  Meta hanya mengoptimalkan "kunjungan situs", bukan order. Jadi campaign ini
  mesin kesempatan, bukan pengganti Campaign A. Order marketplace dicek manual
  dari Seller Center masing-masing.
- **Budget:** mulai Rp 20.000/hari dari dana tambahan — jangan memotong jatah
  Campaign A. Buka hanya setelah A & B stabil (biasanya minggu ke-3+).
- Catatan TikTok Shop: checkout butuh app + login (drop-off tinggi) — di model
  ini Blibli/Lazada yang checkout-nya via web paling mulus.
- **Landing (diputuskan):** halaman produk yang sudah ada di situs (tanpa kode
  baru). Iklan wajib menampilkan produk yang SAMA dengan halaman tujuannya
  (message match). Halaman `/promo` khusus ditunda sampai ada kebutuhan
  campaign event.

---

## 4. Produk Unggulan & Target Audiens

Dipilih dari 707 produk: aman kebijakan Meta + mudah didemokan + harga impulse.

| # | Produk | Harga | Kekuatan | Target |
| --- | --- | --- | --- | --- |
| 1 | GlowHome Foam Cleaner Toilet 500ml | Rp 47.000 | Demo visual "semprot → mengembang → bersih" sangat memukau | Wanita 25–54; broad; interest rumah tangga & home cleaning |
| 2 | Bubuk Ajaib Anti Sumbat WC | Rp 28.000 | Nyeri nyata (WC mampet) & harga murah → konversi cepat | Broad 21–54; interest perawatan rumah |
| 3 | Asahan Pisau Mini Portable | Rp 18.000 | Impulse buy + demo 10 detik langsung terlihat | Broad 18–54; interest dapur & masak |
| 4 | Fertani Penggemuk Ikan 250gr | Rp 54.000 | Niche fanatik (pembudidaya lele/nila/gurame), kompetisi iklan kecil | Pria 25–54; interest budidaya ikan, akuaponik, perikanan |
| 5 | Pupuk Pelebat Buah 250gr | Rp 49.000 | Hobi berkebun sedang naik; visual buah lebat | 25–54; interest berkebun, tanaman buah |
| 6 | Glowhome Washing Machine Cleaner 500ml | Rp 42.000 | Demo kotoran yang keluar dari mesin cuci = konten viral | Wanita 25–54; interest keluarga & laundry |
| 7 | FERTANI Essen Ikan 120X Kapsul (ID 2149) | Rp 59.000 | Pemikat umpan mancing kolam — 1,1 rb terjual, untung ± Rp 40.550; habis pakai → beli ulang; kompetisi iklan kecil | Pria 25–54; interest memancing, umpan pancing, kolam galatama |

> Mulai dengan **maksimal 4 iklan aktif**. Sisa produk masuk "bank" untuk
> menggantikan iklan yang kalah setelah minggu pertama.

**Jangan diiklankan dulu** (risiko policy): herbal pria dewasa (4G Lucky Spray,
Tiga Jari Oil, Wamena Oil), dan klaim kesehatan spesifik penyakit (mis. batu ginjal).

### Produk "Habis Pakai" — mesin orderan berulang

Menjawab pertanyaan "produk apa yang semua orang pasti beli (seperti nasi &
lauk)?": versi **literalnya justru tidak cocok** untuk model COD dropship —
sembako berat (ongkir memakan margin), cepat rusak saat dikirim, harganya
transparan (tak ada ruang untung), dan orang membelinya di warung, bukan
lewat iklan. Terjemahan yang benar untuk toko ini: **barang habis pakai rumah
tangga**, dengan 5 syarat:

1. Semua orang pakai — bukan musiman, bukan niche
2. Habis & dibeli ulang tiap 1–2 bulan → orderan berulang alami
3. Ringan & tahan kirim → aman COD
4. Bukan komoditas harga (tak seperti beras) → masih ada margin
5. Aman kebijakan Meta (tanpa klaim kesehatan)

Data katalog KTD Store sendiri sudah membuktikan (kolom `terjual`):

| Produk | Harga | Terjual |
| --- | --- | --- |
| Glowhome Pembersih Stainless Steel 180ml (ID 1039) | Rp 37.000 | 9,5 rb |
| GlowHome Foam Cleaner Toilet 500ml (ID 1042) | Rp 47.000 | 7,7 rb |
| Detergen Bubuk 8×30gr Cloth Stain Remover (ID 1055) | Rp 28.000 | 4,1 rb |
| So Easy Pembersih Mesin Cuci 2pcs (ID 1054) | Rp 24.000 | 750 |
| Gel Racun Semut (ID 1332) · Gel Racun Kecoa (ID 1331) | Rp 46.000 | 530 · 309 |
| Pembersih Kerak Kamar Mandi (ID 1816) | Rp 59.000 | 126 |

**Tiga cara memonetisasi sifat berulang ini:**

1. **Iklan konsumabel** — sisipkan 1–2 produk habis pakai sebagai iklan ke-5/6
   di Campaign A saat rotasi minggu ke-3. Kandidat terkuat: ID 1055
   (Rp 28.000 — murah = pembelian pertama mudah) dan ID 1054 (Rp 24.000).
2. **Pengingat repeat via WA** — pembeli yang sudah closing diberi label;
   minggu ke-4–6 kirim pengingat personal (ringan, tanpa tekanan — semangatnya
   sama dengan follow-up di `wa-closing.md`). Orderan berulang = tanpa biaya
   iklan baru. Di sinilah "banjir orderan" jangka panjang terjadi.
3. **Paket bulanan** — dorong bundling pembersih yang sudah ada (ID 1326,
   1327, 1317, 1289) sebagai "paket stok sebulan".

**Lubang katalog** (belum ada, layak dicari di supplier — semua universal &
ringan): tisu, kantong sampah, pengharum ruangan/refill, spons & sikat cuci,
pewangi laundry.

### Produk Untung Besar — mesin laba iklan berbayar

Margin tipis mematikan iklan. Patokan internal: **biaya iklan per order ≈
biaya per chat ÷ close rate**. Dengan target biaya per chat ≤ Rp 15.000 dan
close rate 30%, satu order menelan ± Rp 50.000 biaya iklan — jadi untung per
unit harus ≥ Rp 50.000 agar cold traffic sehat (aman: ≥ Rp 75.000). Untung
Rp 15.400 (pembersih stainless ID 1039) hanya cocok untuk retargeting dan
bundling, bukan perburuan pembeli baru.

Hasil analisa 706 produk (skrip: `scripts/analisa-untung-iklan.ps1`) — untung
besar + sudah terbukti laku + aman kebijakan Meta:

| Produk | Harga | Untung/unit | Terjual | Catatan |
| --- | --- | --- | --- | --- |
| Long Clutch Croco Tas Wanita (ID 1463) | Rp 250.000 | ± Rp 163.600 | 468 | Raja untung — 1 closing ≈ 10× margin ID 1039 |
| Bundling Dragon Blood Cream (ID 1255) | Rp 140.000 | ± Rp 91.580 | 1.300 | Permintaan terbukti paling besar di kelas untung besar; copy skincare tanpa klaim berlebihan |
| Dragon Blood Face Cream Retinol (ID 473) | Rp 98.000 | ± Rp 73.340 | 1.600 | Terlaris; ringan 50 gram |
| Long Clutch Zephyrine (ID 1436) | Rp 245.000 | ± Rp 101.000 | 227 | Cadangan terbaik untuk ID 1463 |
| Beli 1 Gratis 1 Minyak Kemiri Bakar (ID 1667) | Rp 125.000 | ± Rp 82.700 | 814 | Perawatan rambut; copy tanpa klaim berlebihan |

Pendukung (untung menengah, paling aman & mudah didemokan — cocok untuk volume
dan repeat): Lampu Kipas LED 2in1 ID 2227 (± Rp 54.000; 1.000 terjual),
Charger GaN 35W ID 2232 (± Rp 51.000; 932), Bundle 5 Lampu LED ID 344
(± Rp 49.500; 957), Bundling GlowHome Toilet ID 1326 (± Rp 41.150; 1.500).

Trade-off yang disadari: menjual Rp 250.000 ke orang dingin lebih sulit
daripada Rp 37.000 — kompensasinya untung ~10×. Kreatif dan copy harus lebih
meyakinkan; tombol COD tetap jadi senjata closing.

Cadangan uji coba Rp 20–30 rb/hari (untung besar, permintaan belum terbukti):
P9 Headphone Wireless ID 293 (± Rp 98.300), Alarm Disc Lock motor ID 307
(± Rp 98.752), Sepatu Boot Kulit Sapi ID 1246 (± Rp 143.900), parfum Timur
Tengah ID 1438 (± Rp 245.000 — harga Rp 650 rb, paling berat dijual dingin).

**Kategori tetap dilarang** (selain daftar di atas): suplemen/madu/propolis
dengan klaim kesehatan, krim pemutih/pembesar/penghilang bekas, obat herbal,
herbisida — bukan karena untungnya kecil, tapi karena risiko kebijakan Meta.

**Peran produk lama:** ID 1039 tetap berputar untuk retargeting (audiens sudah
kenal) dan bundling; 6 produk unggulan sebelumnya tetap dipakai sebagai bank
kreatif — tapi pembeli BARU digiring lewat kandidat untung besar di atas.

---

## 5. Kreatif — Format & Resep Konten

### Video demo (format utama — 80% hasil biasanya dari video)

- **Spec:** 9:16 vertikal (Reels), 15–30 detik, caption teks di layar (wajib —
  85% orang menonton tanpa suara).
- **Resep 5 scene (contoh GlowHome Foam):**

| Detik | Scene | Teks di layar |
| --- | --- | --- |
| 0–3 | Hook: semprot foam ke keramik kusam, foam mengembang | "Keramik kusam? Lihat ini" |
| 3–8 | Masalah: kerak, jamur di sela-sela | "Kerak & jamur di sela toilet" |
| 8–18 | Demo bersih: siram, lap, hasil kinclong | "Tinggal semprot, tunggu, siram" |
| 18–24 | Harga + garansi belanja | "Rp 47.000 — stok ready" |
| 24–30 | CTA | "Klik Kirim Pesan, order via WA — bisa COD" |

- Rekam pakai kamera HP saja (lebih natural = CTR lebih tinggi daripada iklan
  studio). Cahaya matahari / lampu kamar mandi cukup.

### Gambar statis (cadangan & varian)

- Spec 4:5 (1080×1350) — sudah disiapkan 5 visual siap pakai di `creatives/`.
- Desain: produk besar & jelas + 1 kalimat manfaat + harga + badge COD.
- Teks di gambar maksimal ± 20% area — lebih dari itu jangkauan turun.

### 10 hook pembuka yang terbukti (pakai di 3 detik pertama)

1. "Kerak di toilet tidak perlu digosok lagi — ini caranya."
2. "WC mampet jam 9 malam? Tenang."
3. "Pisau tumpul? 10 detik."
4. "Ini yang bikin hasil panen buah jatuh sebelum matang." *(pupuk)*
5. "Ikan lele 2 bulan sudah sebesar ini — rahasianya di pakannya."
6. "Coba lihat apa yang keluar dari mesin cuci ini."
7. "Harga segini, hasilnya begini." *(demo visual)*
8. "Kamu bisa pesan sekarang, bayarnya nanti saat paket sampai."
9. "Stok ready, langsung dikirim hari ini."
10. "Jangan beli sebelum lihat video ini." *(demo)*

---

## 6. KPI & Aturan Keputusan

| Metrik | Target sehat (pasar Indonesia) | Tindakan jika lewat |
| --- | --- | --- |
| CPM | Rp 15.000–50.000 | > Rp 60.000 → ganti kreatif |
| CTR (klik WA) | > 1,5% | < 1% setelah 3 hari → matikan iklan |
| Biaya per chat (cost/conversation) | Rp 10.000–25.000 | > Rp 35.000 → ganti hook/visual |
| Chat → order | 20–40% (gantung kecepatan admin) | < 15% → perbaiki script closing WA |
| Biaya per order | < 30% margin kotor produk | di atas itu → optimasi kreatif dulu, budget terakhir |

**Aturan emas saat pengujian:** ubah **satu variabel saja** per siklus
(kreatif, judul, atau audiens), dan jangan sentuh apa pun di 3–4 hari pertama
per ad set. Keputusan kill diambil setelah minimal ± Rp 100.000 belanja per iklan.

---

## 7. Roadmap 30 Hari

| Hari | Fokus | Detail |
| --- | --- | --- |
| 1–3 | Fondasi | Selesaikan setup akun/pixel (README), verifikasi 5 event, rekam 3 video demo, aktifkan sapaan WA |
| 4–7 | Launch test | CTWA Rp 60.000/hari (4 iklan), pantau tiap hari; jangan ubah apa pun |
| 8–10 | Evaluasi #1 | Matikan iklan CTR < 1% atau cost/chat > Rp 35.000; duplikat pemenang ke iklan baru |
| 11–14 | Retargeting on | Buka Campaign B Rp 15.000/hari; perbaiki script WA berdasar chat nyata |
| 15–21 | Diversifikasi | Rekam 3 video baru (hook berbeda) untuk pemenang; test 1 ad set minat (interest) vs broad |
| 22–30 | Scaling | Naikkan +20–30% per 2–3 hari; tambah produk ke-5/6; evaluasi ROAS 2 minggu → putuskan budget bulan berikutnya |

---

## 8. Operasional WhatsApp (jantung konversi)

Chat masuk adalah "checkout"-nya. Kecepatan & keramahan admin menentukan
apakah biaya iklan jadi order atau hangus.

> Panduan closing LENGKAP (skenario percakapan siap salin, 8 keberatan +
jawabannya, template follow-up FU1/FU2, 9 quick reply siap pasang, dan cara
mengukur close rate) ada di **`wa-closing.md`**. Bagian di bawah ini ringkasannya saja.

**Sapaan otomatis (WA Business → Settings → Business tools → Greeting):**

```
Halo Kak, terima kasih sudah menghubungi KTD Store!
Mau pesan produk apa hari ini? Kirim nama produk / screenshot-nya ya.
Jam operasional: 08.00–21.00 WIB.
```

**Quick replies yang wajib disiapkan:**

| Pemicu chat | Balasan singkat |
| --- | --- |
| "COD?" | "Bisa COD Kak! Bayar saat paket sampai. Biaya COD Rp 2.500/paket. Mau saya bantu hitung total + ongkirnya?" |
| "Ongkir ke ...?" | Arahkan mengisi alamat di halaman produk → ongkir otomatis muncul; atau minta kecamatan & isi sendiri |
| "Asli/BPOM?" | "Produk kami dari supplier resmi, untuk produk kesehatan ada nomor BPOM di halaman produk, Kak." |
| "Stok?" | Cek stok di situs (real-time dari katalog), balas angka pasti |
| Belum jadi order | "Baik Kak, saya simpan pesanannya ya. Kalau ada yang mau ditanyakan, chat saja — stok masih ready hari ini 🙂" |

**Script closing (saat pembeli ragu):**
1. Konfirmasi produk + jumlah + alamat (minta form checkout situs untuk rapi).
2. Sebutkan kenyamanan: "Paket dikirim dari gudang terdekat seller, estimasi
   2–4 hari, bisa dipantau."
3. Tutup dengan pilihan, bukan pertanyaan: "Saya proses ya, Kak — mau COD
   atau transfer?"

---

## 9. Pelacakan & Penamaan

- **UTM untuk campaign yang mengarah ke situs** (retargeting):
  `https://toko.kustoro2026.com/produk/<id>?utm_source=facebook&utm_medium=paid&utm_campaign=ktd-retg-pengunjung&utm_content=<nama-iklan>`
- **Penamaan konsisten** memudahkan evaluasi:
  `KTD | CTWA | Leads | Prospek` · `ID - Broad - 18-54` · `GlowFoam | VideoDemo | v1`
- Pixel events yang sudah aktif: `PageView`, `ViewContent`, `AddToCart`,
  `InitiateCheckout`, `Lead`, `Contact` (lihat README bagian 1).
- Catat manual di spreadsheet harian: belanja, jumlah chat, jumlah order,
  omzet dari iklan → hitung biaya per order & ROAS sendiri (paling akurat
  untuk model WhatsApp).

---

## 10. Kebijakan Meta yang Wajib Dipatuhi

1. Tidak ada klaim berlebihan: "100%", "nomor 1", "termurah", "terbukti
   menyembuhkan" — ditolak otomatis atau membatasi jangkauan.
2. Tidak menyerang kondisi pribadi pembaca ("kamu berjerawat?"), gunakan
   kalimat solusi ("untuk kulit yang ingin tampil cerah").
3. Tidak ada gambar sebelum/sesudah ekstrem (terutama tubuh & kulit).
4. Harga di iklan **wajib sama** dengan situs (Meta memeriksa ketidaksesuaian).
5. Akun yang iklannya ditolak bukan berarti akun mati — perbaiki iklannya.
   Jangan membuat akun bisnis baru; itu memperparah status akun.

---

*Dokumen ini alat kerja — perbarui angkanya sesuai hasil nyata setelah
2 minggu pertama. Copy iklan siap pakai ada di `ad-copy.md`.*
