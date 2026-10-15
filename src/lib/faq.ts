// FAQ produk — satu sumber data untuk tampilan visual (ProductDetailView)
// dan structured data FAQPage (produk/[id]/page.tsx) agar tidak drift.
export type FaqItem = { q: string; a: string };

export const PRODUCT_FAQ: FaqItem[] = [
  {
    q: "Bagaimana cara memesan produk di KTD Store?",
    a: "Pilih produk yang diinginkan, tentukan varian (jika ada), lalu klik tombol \"Pesan via WhatsApp\". Isi nama, alamat pengiriman, dan jumlah pesanan — pesanan Anda langsung diteruskan ke tim kami melalui WhatsApp. CS kami akan mengonfirmasi ketersediaan stok dan ongkos kirim.",
  },
  {
    q: "Metode pembayaran apa saja yang tersedia?",
    a: "Pembayaran dapat dilakukan melalui transfer bank, Virtual Account (BCA, Mandiri, BNI, BRI, dll.), dan QRIS via Duitku, atau disepakati langsung dengan CS setelah pesanan dikonfirmasi. Pesanan diproses setelah pembayaran terverifikasi.",
  },
  {
    q: "Berapa lama pesanan diproses dan dikirim?",
    a: "Pesanan diproses dalam 1×24 jam setelah pembayaran terverifikasi. Pengiriman menggunakan kurir ekspedisi seperti JNE, J&T Express, dan SiCepat — estimasi tiba 2–5 hari kerja tergantung wilayah tujuan.",
  },
  {
    q: "Bagaimana jika produk rusak atau tidak sesuai saat diterima?",
    a: "Hubungi CS kami via WhatsApp atau email info@kustoro2026.com maksimal 2×24 jam setelah paket diterima, sertakan foto produk dan kemasan. Produk yang rusak atau salah kirim dapat dikembalikan atau ditukar sesuai kebijakan KTD Store.",
  },
];
