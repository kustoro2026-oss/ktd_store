import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description:
    "Syarat dan ketentuan penggunaan layanan KTD Store: ketentuan umum, produk, pemesanan, pengiriman, dan kebijakan pengembalian.",
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Ketentuan Umum",
    body: [
      "Dengan mengakses dan menggunakan website KTD Store, Anda dianggap telah membaca, memahami, dan menyetujui seluruh syarat dan ketentuan ini. Jika Anda tidak menyetujui sebagian atau seluruh isi ketentuan, mohon untuk tidak menggunakan layanan kami.",
      "KTD Store berhak mengubah, menambah, atau memperbarui syarat dan ketentuan ini sewaktu-waktu tanpa pemberitahuan sebelumnya. Perubahan berlaku efektif sejak dipublikasikan di halaman ini.",
    ],
  },
  {
    title: "2. Produk & Harga",
    body: [
      "KTD Store menampilkan produk dari supplier pilihan. Gambar produk yang ditampilkan adalah ilustrasi; warna dan detail dapat sedikit berbeda dengan produk asli karena faktor pencahayaan dan pengaturan layar.",
      "Harga yang tertera adalah rekomendasi harga jual dan dapat berubah sewaktu-waktu. Harga final dikonfirmasi melalui Customer Service saat pemesanan.",
    ],
  },
  {
    title: "3. Pemesanan & Pembayaran",
    body: [
      "Seluruh transaksi pembelian saat ini dilakukan melalui pemesanan via WhatsApp. KTD Store tidak menerima pembayaran langsung di website ini.",
      "Pembayaran mengikuti metode yang disepakati bersama Customer Service. Setelah pembayaran dilakukan, pelanggan disarankan melakukan konfirmasi pembayaran agar pesanan segera diproses.",
    ],
  },
  {
    title: "4. Pengiriman",
    body: [
      "Pengiriman dilakukan oleh kurir yang dipilih pelanggan bersama Customer Service. Estimasi waktu pengiriman mengikuti ketentuan kurir dan area tujuan.",
      "KTD Store tidak bertanggung jawab atas keterlambatan pengiriman yang disebabkan oleh kurir, bencana alam, atau kejadian di luar kendali kami.",
    ],
  },
  {
    title: "5. Pengembalian & Penukaran",
    body: [
      "Permintaan pengembalian atau penukaran produk dapat diajukan melalui Customer Service kami. Pastikan produk dalam kondisi asli, belum digunakan, dan kemasan lengkap saat mengajukan pengembalian.",
      "Hubungi Customer Service kami maksimal 2x24 jam setelah paket diterima untuk mendiskusikan solusi terbaik.",
    ],
  },
  {
    title: "6. Batasan Tanggung Jawab",
    body: [
      "KTD Store berupaya menjaga keakuratan informasi produk, namun tidak menjamin bahwa seluruh informasi bebas dari kesalahan. Setiap keputusan pembelian adalah tanggung jawab pelanggan.",
      "KTD Store tidak bertanggung jawab atas kerugian tidak langsung, insidental, atau konsekuensial yang timbul dari penggunaan website ini.",
    ],
  },
  {
    title: "7. Kekayaan Intelektual",
    body: [
      "Seluruh konten di website ini, termasuk logo, desain, teks, dan gambar, adalah milik KTD Store atau pihak ketiga yang telah memberikan izin. Dilarang memperbanyak atau menggunakan konten tanpa izin tertulis.",
    ],
  },
  {
    title: "8. Hukum yang Berlaku",
    body: [
      "Syarat dan ketentuan ini diatur dan ditafsirkan berdasarkan hukum yang berlaku di Republik Indonesia. Setiap perselisihan akan diselesaikan secara musyawarah terlebih dahulu.",
    ],
  },
];

export default function SyaratKetentuanPage() {
  return (
    <div className="container-site py-5">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <span className="text-muted">Syarat &amp; Ketentuan</span>
      </nav>

      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-brand via-brand to-[#c41f05] p-8 text-white shadow-lg sm:p-10">
        <h1 className="flex items-center gap-3 text-2xl font-extrabold sm:text-3xl">
          <FileText className="h-7 w-7" />
          Syarat &amp; Ketentuan
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
          Harap baca dengan saksama syarat dan ketentuan berikut sebelum
          menggunakan layanan KTD Store. Diperbarui terakhir: September 2026.
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
            Ada pertanyaan?
          </h2>
          <p className="mt-1 text-sm text-muted">
            Hubungi Customer Service kami melalui halaman bantuan.
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
