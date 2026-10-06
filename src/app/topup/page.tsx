import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Clock, Gamepad2, ShieldCheck, Wallet } from "lucide-react";
import TopUpOrderForm from "@/components/TopUpOrderForm";

export const metadata: Metadata = {
  title: "Top Up Game — KTD Store",
  description:
    "Top up game murah dan cepat di KTD Store: Mobile Legends dan Free Fire. Proses otomatis setelah pembayaran terverifikasi.",
  alternates: { canonical: "/topup" },
  openGraph: {
    type: "website",
    url: "/topup",
    title: "Top Up Game — KTD Store",
    description:
      "Top up game murah dan cepat di KTD Store: Mobile Legends dan Free Fire. Proses otomatis setelah pembayaran terverifikasi.",
    images: [{ url: "/images/logo.png", width: 512, height: 512, alt: "KTD Store" }],
    siteName: "KTD Store",
    locale: "id_ID",
  },
  twitter: {
    card: "summary",
    title: "Top Up Game — KTD Store",
    description:
      "Top up game murah dan cepat di KTD Store: Mobile Legends dan Free Fire.",
    images: ["/images/logo.png"],
  },
};

const STEPS = [
  {
    icon: Gamepad2,
    title: "Pilih Game & Nominal",
    desc: "Pilih game (Mobile Legends / Free Fire) dan nominal diamond yang diinginkan.",
  },
  {
    icon: Wallet,
    title: "Transfer Pembayaran",
    desc: "Transfer sesuai total ke rekening toko, lalu kirim bukti melalui WhatsApp.",
  },
  {
    icon: Clock,
    title: "Top Up Otomatis",
    desc: "Setelah pembayaran terverifikasi, diamond dikirim otomatis ke akun game Anda.",
  },
];

export default function TopUpPage() {
  return (
    <div className="container-site py-5">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <span className="text-muted">Top Up Game</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <section>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Top Up Game</h1>
          <p className="mt-2 text-sm text-muted">
            Isi diamond game favorit Anda dengan cepat. Pilih nominal, lengkapi ID
            game, lalu selesaikan pembayaran melalui WhatsApp — diamond dikirim
            otomatis.
          </p>

          <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
            <TopUpOrderForm />
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-ink">Cara Top Up</h2>
            <div className="mt-4 space-y-4">
              {STEPS.map((it, i) => (
                <div key={it.title} className="flex gap-3">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/5 text-brand">
                    <it.icon className="h-4.5 w-4.5" />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{it.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{it.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              <p className="text-xs leading-relaxed text-amber-800">
                Pastikan ID Game dan Server yang Anda isi sudah benar. Top up yang
                masuk ke ID salah tidak dapat dikembalikan.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-brand" />
              <p className="text-xs leading-relaxed text-muted">
                Transaksi Anda diproses melalui sistem resmi Digiflazz, sehingga
                aman dan dapat ditelusuri. Simpan bukti transfer Anda.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-ink">Butuh bantuan?</h2>
            <p className="mt-1 text-xs text-muted">
              Hubungi CS kami melalui WhatsApp untuk pertanyaan seputar top up.
            </p>
            <Link
              href="/konfirmasi-pembayaran"
              className="mt-3 inline-block rounded-xl border border-brand/20 bg-brand/5 px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
            >
              Halaman Konfirmasi →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
