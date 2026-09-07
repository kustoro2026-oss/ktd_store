import Link from "next/link";
import { Frown } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container-site py-24 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-muted-2">
        <Frown className="h-8 w-8" />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-ink">404 — Halaman Tidak Ditemukan</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Halaman yang Anda cari tidak tersedia atau sudah dipindahkan. Silakan
        kembali ke beranda atau jelajahi produk kami.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2"
        >
          Ke Beranda
        </Link>
        <Link
          href="/produk"
          className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
        >
          Jelajahi Produk
        </Link>
      </div>
    </div>
  );
}
