// Petunjuk "Cara Pembayaran" per kanal Duitku — gaya akordeon halaman
// pembayaran resmi Duitku (sub-kanal per bank: m-Banking, Internet Banking,
// ATM, dst). Disusun 7 Okt 2026 dari halaman resmi duitku.com
// (cara-pembayaran-*) dan panduan resmi bank. Alur per bank memang berbeda,
// jadi jangan tampilkan langkah generik yang sama untuk semua metode.
//
// Referensi:
// - BRI : duitku.com/cara-pembayaran-melalui-bri-virtual-account
// - BCA : duitku.com/cara-pembayaran-melalui-bca-virtual-account
// - Mandiri: duitku.com/cara-pembayaran-virtual-account-mandiri-duitku
// - Antar bank (BNI/CIMB/dll): duitku.com/apakah-pembayaran-virtual-account-bisa-antar-bank
// - Lainnya: panduan resmi aplikasi bank masing-masing.

export type GuideGroup = {
  /** Judul sub-kanal (mis. "BRImo (Mobile Banking)", "ATM BRI"). */
  title: string;
  /** Langkah bernomor, formal, tanpa emoji. */
  steps: string[];
};

export type PaymentGuide = {
  /** Baris pembuka opsional di atas akordeon (mis. untuk QRIS/e-wallet). */
  via?: string;
  /** Daftar sub-kanal yang bisa dibuka-tutup (akordeon). */
  groups: GuideGroup[];
  /** Catatan opsional di bawah akordeon (mis. alternatif antarbank). */
  note?: string;
};

/** Panduan per kode kanal VA (transfer bank) — grup per saluran bank. */
const VA_GUIDES: Record<string, PaymentGuide> = {
  // BCA VA — sumber: duitku.com/cara-pembayaran-melalui-bca-virtual-account
  BC: {
    groups: [
      {
        title: "BCA mobile (m-BCA)",
        steps: [
          "Login ke aplikasi BCA mobile.",
          "Pilih menu m-Transfer → BCA Virtual Account.",
          "Masukkan nomor Virtual Account di atas, lalu pilih OK.",
          "Periksa nama penerima, masukkan nominal tagihan, lalu selesaikan dengan PIN m-BCA.",
        ],
      },
      {
        title: "KlikBCA (Internet Banking)",
        steps: [
          "Login ke klikBCA Individual.",
          "Pilih menu Transfer Dana → Transfer ke BCA Virtual Account.",
          "Masukkan nomor Virtual Account di atas, lalu pilih Lanjutkan.",
          "Masukkan nominal tagihan, periksa kembali, lalu kirim dengan KeyBCA.",
        ],
      },
      {
        title: "ATM BCA",
        steps: [
          "Masukkan kartu ATM BCA dan PIN.",
          "Pilih menu Transaksi Lainnya → Transfer → Ke Rekening BCA Virtual Account.",
          "Masukkan nomor Virtual Account di atas, lalu pilih Benar.",
          "Masukkan nominal tagihan, periksa kembali, lalu pilih Ya.",
        ],
      },
    ],
    note: "Dari bank lain: pilih transfer ke bank lain dengan kode bank BCA 014, diikuti nomor Virtual Account.",
  },
  // BRI VA — sumber: duitku.com/cara-pembayaran-melalui-bri-virtual-account
  BR: {
    groups: [
      {
        title: "BRImo (Mobile Banking BRI)",
        steps: [
          "Login ke aplikasi BRImo.",
          "Pilih menu Pembayaran → BRIVA.",
          "Masukkan 16 digit nomor Virtual Account di atas.",
          "Masukkan nominal pembayaran, lalu konfirmasi dengan PIN BRImo.",
        ],
      },
      {
        title: "Internet Banking BRI",
        steps: [
          "Login ke ib.bri.co.id.",
          "Pilih menu Pembayaran → BRIVA.",
          "Masukkan 16 digit nomor Virtual Account di atas, lalu klik Kirim.",
          "Periksa data pembayaran, lalu masukkan password dan mToken untuk menyelesaikan.",
        ],
      },
      {
        title: "ATM BRI",
        steps: [
          "Pilih menu Transaksi Lain → Pembayaran → Lainnya → BRIVA.",
          "Masukkan 16 digit nomor Virtual Account di atas.",
          "Masukkan nominal pembayaran, periksa kembali, lalu pilih Ya.",
        ],
      },
      {
        title: "Teller BRI",
        steps: [
          "Ambil slip setoran tunai di kantor cabang BRI.",
          "Isi nomor Virtual Account di atas dan nominal pembayaran.",
          "Serahkan slip kepada petugas teller BRI untuk divalidasi.",
        ],
      },
    ],
    note: "Dari bank lain: pilih transfer ke bank lain dengan kode bank BRI 002, diikuti 16 digit nomor Virtual Account.",
  },
  // Mandiri VA H2H — sumber: duitku.com/cara-pembayaran-virtual-account-mandiri-duitku
  M2: {
    groups: [
      {
        title: "Livin' by Mandiri (m-Banking)",
        steps: [
          "Buka aplikasi Livin' by Mandiri lalu login.",
          "Pilih menu Bayar → Multipayment.",
          "Pilih penyedia jasa DUITKU, lalu masukkan nomor Virtual Account di atas.",
          "Periksa halaman konfirmasi, lalu selesaikan dengan PIN transaksi.",
        ],
      },
      {
        title: "Mandiri Online (Internet Banking)",
        steps: [
          "Login ke situs Mandiri Online (ibank.bankmandiri.co.id).",
          "Pilih menu Pembayaran → Multipayment.",
          "Pilih penyedia jasa DUITKU, masukkan nomor Virtual Account di atas dan nominalnya.",
          "Periksa konfirmasi, lalu selesaikan dengan PIN Token.",
        ],
      },
      {
        title: "ATM Mandiri",
        steps: [
          "Pilih menu Bayar/Beli → Lainnya → Multipayment.",
          "Masukkan kode biller DUITKU (jika diminta) lalu nomor Virtual Account di atas.",
          "Masukkan nominal, periksa kembali, lalu pilih Ya.",
        ],
      },
    ],
  },
  // BNI VA — sumber: panduan resmi BNI Mobile Banking + halaman antarbank Duitku
  I1: {
    groups: [
      {
        title: "BNI Mobile Banking",
        steps: [
          "Login ke aplikasi BNI Mobile Banking.",
          "Pilih menu Transfer → Virtual Account Billing.",
          "Masukkan nomor Virtual Account di atas.",
          "Periksa nama dan nominal, lalu selesaikan dengan password transaksi.",
        ],
      },
      {
        title: "Internet Banking BNI",
        steps: [
          "Login ke ibank.bni.co.id.",
          "Pilih menu Transfer → Rekening BNI, lalu masukkan nomor Virtual Account di atas.",
          "Masukkan nominal pembayaran, lalu klik Lanjut.",
          "Periksa kembali data, lalu konfirmasi dengan kode otentikasi BNI e-Secure.",
        ],
      },
      {
        title: "ATM BNI",
        steps: [
          "Pilih menu Transfer → Dari Rekening Tabungan → Ke Rekening BNI.",
          "Masukkan nomor Virtual Account di atas, lalu masukkan nominal.",
          "Periksa kembali, lalu pilih Tekan Jika Benar.",
        ],
      },
    ],
  },
  // Permata VA — sumber: panduan resmi PermataMobile X / PermataNet
  BT: {
    groups: [
      {
        title: "PermataMobile X",
        steps: [
          "Login ke aplikasi PermataMobile X.",
          "Pilih menu Bayar Tagihan → Virtual Account.",
          "Masukkan nomor Virtual Account di atas.",
          "Periksa nama dan nominal, lalu selesaikan pembayaran.",
        ],
      },
      {
        title: "PermataNet (Internet Banking)",
        steps: [
          "Login ke PermataNet.",
          "Pilih menu Pembayaran → Virtual Account.",
          "Masukkan nomor Virtual Account di atas dan nominalnya.",
          "Konfirmasi dengan token PermataNet.",
        ],
      },
      {
        title: "ATM Permata",
        steps: [
          "Pilih menu Transaksi Lain → Pembayaran → Virtual Account.",
          "Masukkan nomor Virtual Account di atas dan nominalnya.",
          "Periksa kembali, lalu konfirmasi pembayaran.",
        ],
      },
    ],
  },
  // CIMB Niaga VA — sumber: halaman antarbank Duitku (OCTO Mobile) + panduan OCTO
  B1: {
    groups: [
      {
        title: "OCTO Mobile",
        steps: [
          "Login ke aplikasi OCTO Mobile.",
          "Pilih menu Transfer → Transfer ke Rekening CIMB Niaga Lainnya.",
          "Masukkan nomor Virtual Account di atas.",
          "Masukkan nominal, periksa kembali, lalu konfirmasi.",
        ],
      },
      {
        title: "OCTO Clicks (Internet Banking)",
        steps: [
          "Login ke OCTO Clicks.",
          "Pilih menu Transfer Dana → Antar Rekening CIMB Niaga.",
          "Masukkan nomor Virtual Account di atas dan nominalnya.",
          "Konfirmasi dengan kode OTP.",
        ],
      },
      {
        title: "ATM CIMB Niaga",
        steps: [
          "Pilih menu Transfer → ke Rekening CIMB Niaga.",
          "Masukkan nomor Virtual Account di atas, lalu klik OK.",
          "Masukkan nominal, periksa kembali, lalu pilih OK.",
        ],
      },
    ],
  },
  // Maybank VA — sumber: panduan resmi M2U ID (maybank.co.id)
  VA: {
    groups: [
      {
        title: "M2U ID App",
        steps: [
          "Buka aplikasi M2U ID lalu login.",
          "Pilih menu Transfer → Virtual Account.",
          "Masukkan nomor Virtual Account di atas.",
          "Periksa nama dan nominal, lalu selesaikan pembayaran.",
        ],
      },
      {
        title: "M2U ID Web (Internet Banking)",
        steps: [
          "Login ke M2U ID Web di maybank.co.id.",
          "Pilih menu Transfer → Virtual Account.",
          "Masukkan nomor Virtual Account di atas dan nominalnya, lalu konfirmasi.",
        ],
      },
      {
        title: "ATM Maybank",
        steps: [
          "Masukkan kartu ATM Maybank dan PIN.",
          "Pilih menu Virtual Account.",
          "Masukkan 16 digit nomor Virtual Account di atas, periksa kembali, lalu selesaikan pembayaran.",
        ],
      },
    ],
  },
  // BSI VA — sumber: panduan resmi BYOND by BSI
  BV: {
    groups: [
      {
        title: "BYOND by BSI",
        steps: [
          "Buka aplikasi BYOND by BSI lalu login.",
          "Pilih menu Bayar & Beli → kategori Lembaga, lalu cari DUITKU.",
          "Masukkan nomor Virtual Account di atas.",
          "Periksa nama dan nominal, lalu selesaikan pembayaran.",
        ],
      },
      {
        title: "ATM BSI",
        steps: [
          "Pilih menu Bayar/Beli → Lembaga → DUITKU.",
          "Masukkan nomor Virtual Account di atas dan nominalnya.",
          "Periksa kembali, lalu konfirmasi pembayaran.",
        ],
      },
    ],
  },
  // BNC VA (Bank Neo Commerce)
  NC: {
    groups: [
      {
        title: "Aplikasi Bank Neo Commerce",
        steps: [
          "Login ke aplikasi Bank Neo Commerce.",
          "Pilih menu Pembayaran → Virtual Account.",
          "Masukkan nomor Virtual Account di atas.",
          "Periksa nama dan nominal, lalu selesaikan pembayaran.",
        ],
      },
    ],
  },
  // Artha Graha VA
  AG: {
    groups: [
      {
        title: "iBank (Internet Banking Artha Graha)",
        steps: [
          "Login ke iBank Artha Graha.",
          "Pilih menu Transfer → Virtual Account.",
          "Masukkan nomor Virtual Account di atas dan nominalnya.",
          "Periksa kembali, lalu konfirmasi pembayaran.",
        ],
      },
      {
        title: "ATM Artha Graha",
        steps: [
          "Pilih menu Transaksi Lainnya → Pembayaran → Virtual Account.",
          "Masukkan nomor Virtual Account di atas dan nominalnya.",
          "Periksa kembali, lalu selesaikan pembayaran.",
        ],
      },
    ],
  },
  // Sampoerna VA (Bank Sahabat Sampoerna)
  S1: {
    groups: [
      {
        title: "Bank Sahabat Sampoerna m-Banking",
        steps: [
          "Buka aplikasi Bank Sahabat Sampoerna lalu login.",
          "Pilih menu Pembayaran → Virtual Account.",
          "Masukkan nomor Virtual Account di atas.",
          "Periksa nama dan nominal, lalu selesaikan pembayaran.",
        ],
      },
      {
        title: "ATM Bank Sahabat Sampoerna",
        steps: [
          "Pilih menu Transaksi Lainnya → Pembayaran → Virtual Account.",
          "Masukkan nomor Virtual Account di atas dan nominalnya.",
          "Periksa kembali, lalu konfirmasi pembayaran.",
        ],
      },
    ],
  },
  // ATM Bersama VA — bayar dari ATM mana pun jaringan ATM Bersama/Prima/ALTO
  A1: {
    groups: [
      {
        title: "ATM mana pun (ATM Bersama / Prima / ALTO)",
        steps: [
          "Datangi ATM mana pun yang berjaringan ATM Bersama / Prima / ALTO.",
          "Pilih menu Transaksi Lainnya → Pembayaran → Virtual Account.",
          "Masukkan nomor Virtual Account di atas.",
          "Periksa nama dan nominal, lalu selesaikan pembayaran.",
        ],
      },
    ],
  },
};

/** Panduan per kode kanal redirect (e-wallet, kartu, gerai retail). */
const REDIRECT_GUIDES: Record<string, PaymentGuide> = {
  OV: {
    via: "Aplikasi OVO",
    groups: [
      {
        title: "Bayar via OVO",
        steps: [
          "Klik tombol Buka Pembayaran.",
          "Pilih OVO dan masukkan nomor HP yang terdaftar di OVO.",
          "Buka aplikasi OVO untuk menyetujui permintaan pembayaran.",
          "Konfirmasi pembayaran di aplikasi OVO.",
        ],
      },
    ],
  },
  DA: {
    via: "Aplikasi DANA",
    groups: [
      {
        title: "Bayar via DANA",
        steps: [
          "Klik tombol Buka Pembayaran.",
          "Pilih DANA dan masukkan nomor HP yang terdaftar di DANA.",
          "Buka aplikasi DANA lalu setujui permintaan pembayaran.",
          "Konfirmasi pembayaran di aplikasi DANA.",
        ],
      },
    ],
  },
  LA: {
    via: "Aplikasi LinkAja",
    groups: [
      {
        title: "Bayar via LinkAja",
        steps: [
          "Klik tombol Buka Pembayaran.",
          "Pilih LinkAja dan masukkan nomor HP yang terdaftar.",
          "Buka aplikasi LinkAja lalu setujui permintaan pembayaran.",
          "Konfirmasi pembayaran di aplikasi LinkAja.",
        ],
      },
    ],
  },
  SA: {
    via: "Aplikasi Shopee (ShopeePay)",
    groups: [
      {
        title: "Bayar via ShopeePay",
        steps: [
          "Klik tombol Buka Pembayaran.",
          "Pilih ShopeePay dan masukkan nomor HP yang terdaftar di Shopee.",
          "Buka aplikasi Shopee lalu setujui permintaan pembayaran.",
          "Konfirmasi pembayaran di aplikasi Shopee.",
        ],
      },
    ],
  },
  DN: {
    via: "Akun Indodana",
    groups: [
      {
        title: "Bayar via Indodana Paylater",
        steps: [
          "Klik tombol Buka Pembayaran.",
          "Masuk ke akun Indodana Anda.",
          "Pilih tenor cicilan yang diinginkan.",
          "Konfirmasi pembayaran cicilan.",
        ],
      },
    ],
  },
  JP: {
    via: "Aplikasi Jenius (Jenius Pay)",
    groups: [
      {
        title: "Bayar via Jenius Pay",
        steps: [
          "Klik tombol Buka Pembayaran.",
          "Masukkan cashtag atau nomor HP Jenius Anda.",
          "Buka aplikasi Jenius lalu setujui permintaan pembayaran.",
          "Konfirmasi pembayaran di aplikasi Jenius.",
        ],
      },
    ],
  },
  VC: {
    via: "Halaman pembayaran aman Duitku",
    groups: [
      {
        title: "Bayar dengan Kartu Kredit/Debit",
        steps: [
          "Klik tombol Buka Pembayaran.",
          "Masukkan nomor kartu, masa berlaku, dan CVV di halaman aman Duitku.",
          "Selesaikan verifikasi 3DS / OTP dari bank penerbit kartu.",
        ],
      },
    ],
  },
  IR: {
    via: "Kasir Indomaret",
    groups: [
      {
        title: "Bayar tunai di Indomaret",
        steps: [
          "Klik tombol Buka Pembayaran.",
          "Catat kode pembayaran yang muncul di halaman.",
          "Tunjukkan kode tersebut ke kasir Indomaret lalu bayar tunai.",
        ],
      },
    ],
  },
  FT: {
    via: "Gerai retail terdekat (Indomaret, Alfamart, dan lainnya)",
    groups: [
      {
        title: "Bayar tunai di gerai retail",
        steps: [
          "Klik tombol Buka Pembayaran.",
          "Catat kode pembayaran yang muncul di halaman.",
          "Bayar tunai di gerai retail terdekat dengan menunjukkan kode tersebut.",
        ],
      },
    ],
  },
};

/** Panduan QRIS — berlaku untuk semua kanal QRIS (SP, NQ, SQ). */
const QRIS_GUIDE: PaymentGuide = {
  via: "Semua aplikasi QRIS (GoPay, OVO, DANA, ShopeePay, LinkAja, m-Banking)",
  groups: [
    {
      title: "Scan QRIS",
      steps: [
        "Buka aplikasi e-wallet atau m-Banking Anda.",
        "Pilih menu Scan / Scan QRIS.",
        "Scan kode QRIS di atas.",
        "Periksa nama merchant dan nominal, lalu konfirmasi.",
      ],
    },
  ],
};

const FALLBACK_VA: PaymentGuide = {
  groups: [
    {
      title: "Aplikasi m-Banking bank tujuan",
      steps: [
        "Buka aplikasi m-Banking bank tujuan lalu login.",
        "Pilih menu Transfer / Pembayaran → Virtual Account.",
        "Masukkan nomor Virtual Account di atas.",
        "Periksa nama dan nominal, lalu selesaikan pembayaran.",
      ],
    },
  ],
};

const FALLBACK_REDIRECT: PaymentGuide = {
  via: "Halaman pembayaran aman Duitku (tab baru)",
  groups: [
    {
      title: "Selesaikan di halaman Duitku",
      steps: [
        "Klik tombol Buka Pembayaran.",
        "Selesaikan pembayaran di halaman Duitku yang aman.",
        "Kembali ke tab ini — status pesanan dicek otomatis.",
      ],
    },
  ],
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
  if (opts.qr) return QRIS_GUIDE;
  if (opts.va) return VA_GUIDES[code] ?? FALLBACK_VA;
  return REDIRECT_GUIDES[code] ?? FALLBACK_REDIRECT;
}
