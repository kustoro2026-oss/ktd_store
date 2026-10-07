// Petunjuk "Cara Pembayaran" per kanal Duitku — disusun 7 Okt 2026 dari
// halaman resmi Duitku (duitku.com/cara-pembayaran-*) dan panduan resmi
// bank/aplikasi. Kode kanal sesuai daftar live getpaymentmethod
// (GET /api/duitku/methods). Alur per bank memang berbeda, jadi jangan
// tampilkan langkah generik yang sama untuk semua metode.

export type PaymentGuide = {
  /** Kanal/aplikasi yang dipakai pembeli (baris "Melalui"). */
  via: string;
  /** Langkah bernomor, formal, tanpa emoji. */
  steps: string[];
  /** Catatan opsional (mis. cara alternatif lewat ATM). */
  note?: string;
};

/** Panduan per kode kanal VA (transfer bank). */
const VA_GUIDES: Record<string, { via: string; steps: string[]; note?: string }> = {
  // BCA VA — sumber: duitku.com/cara-pembayaran-melalui-bca-virtual-account
  BC: {
    via: "BCA mobile (m-BCA) atau KlikBCA",
    steps: [
      "Buka aplikasi BCA mobile lalu login.",
      "Pilih menu m-Transfer → BCA Virtual Account.",
      "Masukkan nomor Virtual Account di atas.",
      "Periksa nama dan nominal, lalu selesaikan dengan PIN.",
    ],
    note: "Bisa juga lewat ATM BCA: Transaksi Lainnya → Transfer → Ke Rekening BCA Virtual Account.",
  },
  // BRI VA — sumber: duitku.com/cara-pembayaran-melalui-bri-virtual-account
  BR: {
    via: "BRImo (Bank BRI)",
    steps: [
      "Buka aplikasi BRImo lalu login.",
      "Pilih menu Pembayaran → BRIVA.",
      "Masukkan nomor Virtual Account di atas.",
      "Periksa nama dan nominal, lalu selesaikan dengan PIN.",
    ],
    note: "Bisa juga lewat ATM BRI: Transaksi Lain → Pembayaran → Lainnya → BRIVA.",
  },
  // Mandiri VA — sumber: duitku.com/cara-pembayaran-virtual-account-mandiri-duitku
  M2: {
    via: "Livin' by Mandiri",
    steps: [
      "Buka aplikasi Livin' by Mandiri lalu login.",
      "Pilih menu Bayar → Multi Payment.",
      'Cari dan pilih penyedia "DUITKU".',
      "Masukkan nomor Virtual Account di atas, lalu bayar.",
    ],
    note: "Di ATM Mandiri: pilih Bayar/Beli → Lainnya → Multipayment.",
  },
  // BNI VA — sumber: panduan resmi BNI Mobile Banking
  I1: {
    via: "BNI Mobile Banking",
    steps: [
      "Buka aplikasi BNI Mobile Banking lalu login.",
      "Pilih menu Transfer → Virtual Account Billing.",
      "Masukkan nomor Virtual Account di atas.",
      "Periksa nama dan nominal, lalu selesaikan dengan PIN.",
    ],
  },
  // Permata VA — sumber: panduan resmi PermataMobile X
  BT: {
    via: "PermataMobile X",
    steps: [
      "Buka aplikasi PermataMobile X lalu login.",
      "Pilih menu Bayar Tagihan → Virtual Account.",
      "Masukkan nomor Virtual Account di atas.",
      "Periksa nama dan nominal, lalu selesaikan pembayaran.",
    ],
  },
  // CIMB Niaga VA — sumber: panduan resmi OCTO Mobile
  B1: {
    via: "OCTO Mobile (CIMB Niaga)",
    steps: [
      "Buka aplikasi OCTO Mobile lalu login.",
      "Pilih menu Transfer → Transfer ke Rekening CIMB Lainnya.",
      "Masukkan nomor Virtual Account di atas.",
      "Masukkan nominal, lalu konfirmasi pembayaran.",
    ],
  },
  // Maybank VA — sumber: maybank.co.id (fitur Transfer Virtual Account)
  VA: {
    via: "M2U ID App (Maybank2U)",
    steps: [
      "Buka aplikasi M2U ID App lalu login.",
      "Pilih menu Transfer → Virtual Account.",
      "Masukkan nomor Virtual Account di atas.",
      "Periksa nama dan nominal, lalu selesaikan pembayaran.",
    ],
  },
  // BSI VA — sumber: panduan resmi BYOND by BSI
  BV: {
    via: "BYOND by BSI",
    steps: [
      "Buka aplikasi BYOND by BSI lalu login.",
      "Pilih menu Bayar & Beli → kategori Lembaga.",
      'Cari "DUITKU" lalu masukkan nomor Virtual Account.',
      "Periksa nama dan nominal, lalu selesaikan pembayaran.",
    ],
  },
  // BNC VA (Bank Neo Commerce)
  NC: {
    via: "Aplikasi Bank Neo Commerce",
    steps: [
      "Buka aplikasi Bank Neo Commerce lalu login.",
      "Pilih menu Pembayaran → Virtual Account.",
      "Masukkan nomor Virtual Account di atas.",
      "Periksa nama dan nominal, lalu selesaikan pembayaran.",
    ],
  },
  // Artha Graha VA
  AG: {
    via: "iBank / aplikasi Artha Graha",
    steps: [
      "Login ke iBank atau aplikasi Artha Graha.",
      "Pilih menu Transfer → Virtual Account.",
      "Masukkan nomor Virtual Account di atas.",
      "Periksa nama dan nominal, lalu selesaikan pembayaran.",
    ],
  },
  // Sampoerna VA (Bank Sahabat Sampoerna)
  S1: {
    via: "Bank Sahabat Sampoerna m-Banking",
    steps: [
      "Buka aplikasi Bank Sahabat Sampoerna lalu login.",
      "Pilih menu Pembayaran → Virtual Account.",
      "Masukkan nomor Virtual Account di atas.",
      "Periksa nama dan nominal, lalu selesaikan pembayaran.",
    ],
  },
  // ATM Bersama VA — bayar dari ATM mana pun jaringan ATM Bersama/Prima/ALTO
  A1: {
    via: "ATM mana pun (jaringan ATM Bersama / Prima / ALTO)",
    steps: [
      "Datangi ATM mana pun yang berjaringan ATM Bersama / Prima / ALTO.",
      "Pilih menu Transaksi Lainnya → Pembayaran → Virtual Account.",
      "Masukkan nomor Virtual Account di atas.",
      "Periksa nama dan nominal, lalu selesaikan pembayaran.",
    ],
  },
};

/** Panduan per kode kanal redirect (e-wallet, kartu, gerai retail). */
const REDIRECT_GUIDES: Record<string, { via: string; steps: string[] }> = {
  OV: {
    via: "Aplikasi OVO",
    steps: [
      "Klik tombol Buka Pembayaran.",
      "Pilih OVO dan masukkan nomor HP yang terdaftar di OVO.",
      "Buka aplikasi OVO untuk menyetujui permintaan pembayaran.",
      "Konfirmasi pembayaran di aplikasi OVO.",
    ],
  },
  DA: {
    via: "Aplikasi DANA",
    steps: [
      "Klik tombol Buka Pembayaran.",
      "Pilih DANA dan masukkan nomor HP yang terdaftar di DANA.",
      "Buka aplikasi DANA lalu setujui permintaan pembayaran.",
      "Konfirmasi pembayaran di aplikasi DANA.",
    ],
  },
  LA: {
    via: "Aplikasi LinkAja",
    steps: [
      "Klik tombol Buka Pembayaran.",
      "Pilih LinkAja dan masukkan nomor HP yang terdaftar.",
      "Buka aplikasi LinkAja lalu setujui permintaan pembayaran.",
      "Konfirmasi pembayaran di aplikasi LinkAja.",
    ],
  },
  SA: {
    via: "Aplikasi Shopee (ShopeePay)",
    steps: [
      "Klik tombol Buka Pembayaran.",
      "Pilih ShopeePay dan masukkan nomor HP yang terdaftar di Shopee.",
      "Buka aplikasi Shopee lalu setujui permintaan pembayaran.",
      "Konfirmasi pembayaran di aplikasi Shopee.",
    ],
  },
  DN: {
    via: "Akun Indodana",
    steps: [
      "Klik tombol Buka Pembayaran.",
      "Masuk ke akun Indodana Anda.",
      "Pilih tenor cicilan yang diinginkan.",
      "Konfirmasi pembayaran cicilan.",
    ],
  },
  JP: {
    via: "Aplikasi Jenius (Jenius Pay)",
    steps: [
      "Klik tombol Buka Pembayaran.",
      "Masukkan cashtag atau nomor HP Jenius Anda.",
      "Buka aplikasi Jenius lalu setujui permintaan pembayaran.",
      "Konfirmasi pembayaran di aplikasi Jenius.",
    ],
  },
  VC: {
    via: "Halaman pembayaran aman Duitku",
    steps: [
      "Klik tombol Buka Pembayaran.",
      "Masukkan nomor kartu, masa berlaku, dan CVV di halaman aman Duitku.",
      "Selesaikan verifikasi 3DS / OTP dari bank penerbit kartu.",
    ],
  },
  IR: {
    via: "Kasir Indomaret",
    steps: [
      "Klik tombol Buka Pembayaran.",
      "Catat kode pembayaran yang muncul di halaman.",
      "Tunjukkan kode tersebut ke kasir Indomaret lalu bayar tunai.",
    ],
  },
  FT: {
    via: "Gerai retail terdekat (Indomaret, Alfamart, dan lainnya)",
    steps: [
      "Klik tombol Buka Pembayaran.",
      "Catat kode pembayaran yang muncul di halaman.",
      "Bayar tunai di gerai retail terdekat dengan menunjukkan kode tersebut.",
    ],
  },
};

/**
 * Susun panduan "Cara Pembayaran" untuk kanal yang benar-benar dipakai.
 * Cabang mengikuti bentuk respons inquiry Duitku: qr → QRIS, va → bank,
 * selainnya → redirect ke halaman Duitku.
 */
export function getPaymentGuide(
  channel: string | undefined,
  opts: { qr: boolean; va: boolean },
): PaymentGuide {
  const code = (channel ?? "").toUpperCase();
  if (opts.qr) {
    return {
      via: "Semua aplikasi QRIS (GoPay, OVO, DANA, ShopeePay, LinkAja, m-Banking)",
      steps: [
        "Buka aplikasi e-wallet atau m-Banking Anda.",
        "Pilih menu Scan / Scan QRIS.",
        "Scan kode QRIS di atas.",
        "Periksa nama merchant dan nominal, lalu konfirmasi.",
      ],
    };
  }
  if (opts.va) {
    const g = VA_GUIDES[code];
    return g
      ? { ...g }
      : {
          via: "Aplikasi m-Banking bank tujuan",
          steps: [
            "Buka aplikasi m-Banking bank tujuan lalu login.",
            "Pilih menu Transfer / Pembayaran → Virtual Account.",
            "Masukkan nomor Virtual Account di atas.",
            "Periksa nama dan nominal, lalu selesaikan pembayaran.",
          ],
        };
  }
  const r = REDIRECT_GUIDES[code];
  return r
    ? { ...r }
    : {
        via: "Halaman pembayaran aman Duitku (tab baru)",
        steps: [
          "Klik tombol Buka Pembayaran.",
          "Selesaikan pembayaran di halaman Duitku yang aman.",
          "Kembali ke tab ini — status pesanan dicek otomatis.",
        ],
      };
}
