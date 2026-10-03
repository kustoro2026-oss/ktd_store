import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Kebijakan privasi KTD Store: data yang dikumpulkan, penggunaan data, berbagi data dengan pihak ketiga, keamanan, dan hak pengguna.",
  alternates: { canonical: "/kebijakan-privasi" },
  openGraph: {
    type: "website",
    url: "/kebijakan-privasi",
    title: "Kebijakan Privasi — KTD Store",
    description:
      "Kebijakan privasi KTD Store: data yang dikumpulkan, penggunaan data, berbagi data dengan pihak ketiga, keamanan, dan hak pengguna.",
    images: [{ url: "/images/logo.png", width: 512, height: 512, alt: "KTD Store" }],
    siteName: "KTD Store",
    locale: "id_ID",
  },
  twitter: {
    card: "summary",
    title: "Kebijakan Privasi — KTD Store",
    description:
      "Kebijakan privasi KTD Store: data yang dikumpulkan, penggunaan data, berbagi data dengan pihak ketiga, keamanan, dan hak pengguna.",
    images: ["/images/logo.png"],
  },
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Data yang Kami Kumpulkan",
    body: [
      "Saat Anda memesan produk melalui WhatsApp, kami mengumpulkan data yang Anda kirimkan: nama, nomor telepon, dan alamat pengiriman. Data tersebut diperlukan untuk memproses dan mengirimkan pesanan Anda.",
      "Kami juga dapat menerima data produk yang Anda pesan beserta perhitungan ongkos kirim yang dihasilkan dari formulir pemesanan di website ini.",
      "Data teknis non-pribadi, seperti jenis perangkat dan statistik kunjungan, dapat dikumpulkan untuk kepentingan analisis dan peningkatan layanan website.",
    ],
  },
  {
    title: "2. Penggunaan Data",
    body: [
      "Data Anda digunakan untuk: memproses pesanan, menghitung ongkos kirim, mengatur pengiriman melalui kurir, konfirmasi pembayaran, dan layanan pelanggan.",
      "Data kontak juga dapat digunakan untuk mengirimkan informasi promosi dan pengiriman nomor resi melalui WhatsApp, sepanjang Anda melakukan komunikasi dengan kami.",
    ],
  },
  {
    title: "3. Berbagi Data dengan Pihak Ketiga",
    body: [
      "Data pengiriman dibagikan kepada kurir yang Anda pilih agar paket dapat diantarkan ke alamat tujuan.",
      "Jika Anda bertransaksi melalui marketplace resmi kami (Blibli, TikTok Shop, dan Lazada), pengelolaan data mengikuti kebijakan privasi marketplace masing-masing.",
      "Layanan pesan WhatsApp kami berjalan di atas platform Meta (WhatsApp Business API). Percakapan Anda melalui WhatsApp tunduk pada kebijakan privasi WhatsApp dan Meta.",
      "Kami tidak menjual atau menyewakan data pribadi Anda kepada pihak mana pun.",
    ],
  },
  {
    title: "4. Keamanan Data",
    body: [
      "Kami menjaga kerahasiaan data Anda dan membatasi aksesnya hanya untuk keperluan pemrosesan pesanan dan layanan pelanggan.",
      "Pembayaran transfer dilakukan ke rekening resmi toko; kami tidak pernah meminta PIN, password, atau kode OTP apa pun.",
    ],
  },
  {
    title: "5. Penyimpanan Data",
    body: [
      "Data pesanan disimpan selama diperlukan untuk kepentingan transaksi, pengiriman, dan pencatatan usaha, sesuai peraturan yang berlaku.",
    ],
  },
  {
    title: "6. Hak Anda",
    body: [
      "Anda berhak meminta akses, perbaikan, atau penghapusan data pribadi Anda dengan menghubungi Customer Service kami melalui email atau WhatsApp yang tertera di bawah.",
    ],
  },
  {
    title: "7. Perubahan Kebijakan",
    body: [
      "Kebijakan privasi ini dapat diperbarui sewaktu-waktu. Perubahan berlaku efektif sejak dipublikasikan di halaman ini.",
    ],
  },
];

export default function KebijakanPrivasiPage() {
  return (
    <div className="container-site py-5">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <span className="text-muted">Kebijakan Privasi</span>
      </nav>

      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-brand via-brand to-[#c41f05] p-8 text-white shadow-lg sm:p-10">
        <h1 className="flex items-center gap-3 text-2xl font-extrabold sm:text-3xl">
          <FileText className="h-7 w-7" />
          Kebijakan Privasi
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
          Kami menghargai privasi Anda. Halaman ini menjelaskan data yang kami
          kumpulkan dan bagaimana data tersebut digunakan. Diperbarui terakhir:
          Oktober 2026.
        </p>
      </section>

      {/* Sections */}
      <section className="mx-auto mt-8 max-w-3xl space-y-6">
        {SECTIONS.map((s) => (
          <div
            key={s.title}
            className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
          >
            <h2 className="text-base font-bold text-ink sm:text-lg">{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-2.5 text-sm leading-7 text-muted">
                {p}
              </p>
            ))}
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="mx-auto mt-10 flex max-w-3xl flex-col items-center gap-3 rounded-2xl border border-brand/15 bg-brand/5 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="flex items-center justify-center gap-2 text-lg font-bold text-ink sm:justify-start">
            <ShieldCheck className="h-5 w-5 text-brand" />
            Ada pertanyaan soal privasi?
          </h2>
          <p className="mt-1 text-sm text-muted">
            Hubungi Customer Service kami melalui email info@kustoro2026.com
            atau halaman bantuan.
          </p>
        </div>
        <Link
          href="/bantuan"
          className="shrink-0 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-2"
        >
          Ke Pusat Bantuan
        </Link>
      </section>
    </div>
  );
}
