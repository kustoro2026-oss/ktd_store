"use client";

// Halaman pembayaran top-up: tampilkan pembayaran Duitku langsung di halaman
// ini — QR code QRIS (dari qrString inquiry) atau nomor VA — + polling status
// pesanan tiap 5 detik. Status diperbarui server-side oleh webhook Duitku
// (dibayar → eksekusi otomatis → WA), jadi halaman ini cukup memantau tabel
// pesanan.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import { formatRupiah } from "@/lib/topup";
import { whatsappLink } from "@/lib/config";

type OrderView = {
  id: string;
  product_name: string;
  customer_no: string;
  amount: number;
  buyer_name: string;
  payment_status: string;
  topup_status: string;
  payment_url: string;
  /** Nomor VA (bila metode VA) — ditampilkan langsung tanpa redirect. */
  payment_va: string;
  /** String QRIS (bila metode QRIS) — dirender jadi QR code di halaman ini. */
  payment_qr: string;
  paid_at: string;
  digiflazz_sn: string;
  error_message: string;
  created_at: string;
};

const POLL_MS = 5000;

export default function TopupBayarPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  // Redirect Duitku membawa resultCode: 00 sukses, 01 pending, 02 dibatalkan.
  const canceled =
    search.get("dibatalkan") === "1" || search.get("resultCode") === "02";

  const [order, setOrder] = useState<OrderView | null>(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard ditolak browser — abaikan, pembeli bisa menyalin manual.
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/topup/order/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (res.status === 404) {
        setMissing(true);
        return;
      }
      if (res.ok && j.ok) {
        setOrder(j.order as OrderView);
        setMissing(false);
      }
    } catch {
      // Jaringan bermasalah — biarkan polling ronde berikutnya.
    }
  }, [id]);

  useEffect(() => {
    // Muat awal + polling tiap 5 detik. load() asinkron — setState terjadi
    // setelah fetch, bukan sinkron di badan efek.
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (missing) {
    return (
      <div className="container-site flex min-h-[50vh] flex-col items-center justify-center gap-3 py-10 text-center">
        <XCircle className="h-12 w-12 text-red-400" />
        <h1 className="text-lg font-bold text-ink">Pesanan Tidak Ditemukan</h1>
        <p className="max-w-md text-sm text-muted">
          Pesanan dengan nomor ini tidak ada. Mungkin tautannya salah atau pesanan
          sudah terhapus.
        </p>
        <Link
          href="/topup"
          className="mt-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-2"
        >
          Kembali ke Top Up
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container-site flex min-h-[50vh] flex-col items-center justify-center gap-3 py-10 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-brand" />
        <p className="text-sm text-muted">Memuat pesanan...</p>
      </div>
    );
  }

  const paid = order.payment_status === "paid";
  const done = order.topup_status === "success";
  const topupFailed = order.topup_status === "failed";
  const processing = paid && (order.topup_status === "processing" || order.topup_status === "pending");
  const expired = order.payment_status === "expired" || order.payment_status === "failed";
  const waiting = order.payment_status === "pending";

  return (
    <div className="container-site py-5">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/topup" className="flex items-center gap-1 text-muted transition-colors hover:text-brand">
          <ArrowLeft className="h-3.5 w-3.5" /> Top Up
        </Link>
        <span>/</span>
        <span className="text-muted">Pembayaran {order.id}</span>
      </nav>

      <h1 className="text-xl font-bold text-ink sm:text-2xl">Pembayaran Top Up</h1>
      <p className="mt-1 text-sm text-muted">
        {order.id} • {order.product_name}
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Kolom utama */}
        <div className="space-y-4">
          {canceled && waiting && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Pembayaran dibatalkan. Anda masih bisa melanjutkan pembayaran di
              bawah ini selama pesanan belum kedaluwarsa.
            </p>
          )}

          {waiting && order.payment_url && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Clock3 className="h-4 w-4 text-amber-500" /> Menunggu Pembayaran
                </p>
                <p className="text-base font-extrabold text-brand">
                  {formatRupiah(order.amount)}
                </p>
              </div>

              {order.payment_qr ? (
                <div className="mt-4 flex flex-col items-center gap-3">
                  <div className="rounded-2xl border-2 border-gray-100 bg-white p-4">
                    <QRCodeSVG
                      value={order.payment_qr}
                      size={200}
                      level="M"
                      marginSize={2}
                    />
                  </div>
                  <p className="max-w-xs text-center text-xs leading-relaxed text-muted">
                    Scan kode QRIS di atas dari aplikasi bank / e-wallet (GoPay,
                    OVO, DANA, ShopeePay, m-Banking, dll) untuk membayar tanpa
                    pindah halaman.
                  </p>
                </div>
              ) : order.payment_va ? (
                <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-muted-2">
                    Nomor Virtual Account
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="break-all font-mono text-lg font-bold tracking-wider text-ink">
                      {order.payment_va}
                    </p>
                    <button
                      type="button"
                      onClick={() => copy(order.payment_va)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-2"
                    >
                      {copied ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? "Tersalin" : "Salin"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    Transfer tepat sebesar{" "}
                    <b>{formatRupiah(order.amount)}</b> ke nomor VA di atas —
                    pesanan otomatis terverifikasi setelah transfer diterima.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
                <a
                  href={order.payment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
                >
                  Atau bayar lewat halaman Duitku (semua metode){" "}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <p className="text-center text-xs text-muted">
                  Halaman ini otomatis berubah setelah pembayaran terverifikasi.
                </p>
              </div>
            </div>
          )}

          {waiting && !order.payment_url && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <Clock3 className="h-4 w-4 text-amber-500" /> Pesanan Tercatat
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Pesanan Anda sudah tercatat dan akan diverifikasi oleh CS kami.
                Silakan lanjutkan pembayaran via WhatsApp (transfer manual) dan
                lampirkan bukti transfer.
              </p>
              <a
                href={whatsappLink(`Halo, saya ingin konfirmasi pesanan top up ${order.id} (${order.product_name}).`)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1eb85a]"
              >
                Lanjutkan via WhatsApp <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}

          {processing && (
            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-sky-800">
                <Loader2 className="h-4 w-4 animate-spin" /> Pembayaran Diterima — Sedang Diproses
              </p>
              <p className="mt-2 text-sm leading-relaxed text-sky-700">
                Top up Anda sedang dikirim ke {order.customer_no}. Biasanya selesai
                dalam beberapa menit — status akan ter-update otomatis di halaman ini.
              </p>
            </div>
          )}

          {done && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="h-5 w-5" /> Top Up Berhasil
              </p>
              <p className="mt-2 text-sm leading-relaxed text-emerald-700">
                Top up {order.product_name} ke {order.customer_no} sudah berhasil
                dikirim.
                {order.digiflazz_sn ? ` Nomor SN: ${order.digiflazz_sn}.` : ""} Detail
                status juga kami kirimkan ke WhatsApp Anda.
              </p>
            </div>
          )}

          {topupFailed && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-red-700">
                <XCircle className="h-5 w-5" /> Top Up Belum Berhasil
              </p>
              <p className="mt-2 text-sm leading-relaxed text-red-700">
                {order.error_message || "Top up gagal diproses."} Hubungi CS kami
                melalui WhatsApp untuk cek ulang atau pengembalian dana.
              </p>
              <a
                href={whatsappLink(`Halo, saya butuh bantuan untuk pesanan top up ${order.id} (${order.product_name}).`)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1eb85a]"
              >
                Hubungi CS <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}

          {expired && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-red-700">
                <XCircle className="h-5 w-5" /> Pembayaran Kedaluwarsa
              </p>
              <p className="mt-2 text-sm text-red-700">
                Waktu pembayaran pesanan ini sudah habis. Silakan buat pesanan baru.
              </p>
              <Link
                href="/topup"
                className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-2"
              >
                Buat Pesanan Baru
              </Link>
            </div>
          )}
        </div>

        {/* Ringkasan pesanan */}
        <aside className="h-fit rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-ink">Ringkasan Pesanan</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-2">No. Pesanan</dt>
              <dd className="font-semibold text-ink">{order.id}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-2">Produk</dt>
              <dd className="text-right font-medium text-ink">{order.product_name}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-2">Tujuan</dt>
              <dd className="font-mono text-ink">{order.customer_no}</dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-gray-100 pt-2">
              <dt className="text-muted-2">Total</dt>
              <dd className="text-base font-extrabold text-brand">{formatRupiah(order.amount)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-2">Status Bayar</dt>
              <dd
                className={
                  order.payment_status === "paid"
                    ? "font-semibold text-emerald-600"
                    : expired
                      ? "font-semibold text-red-600"
                      : "font-semibold text-amber-600"
                }
              >
                {order.payment_status === "paid"
                  ? "Lunas"
                  : order.payment_status === "expired"
                    ? "Kedaluwarsa"
                    : order.payment_status === "failed"
                      ? "Gagal"
                      : "Menunggu"}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
