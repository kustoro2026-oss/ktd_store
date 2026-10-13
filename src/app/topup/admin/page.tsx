"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Play,
  Search,
  Wallet,
} from "lucide-react";
import { formatRupiah } from "@/lib/topup";

/**
 * Halaman admin top-up (internal CS) — alur pesanan WhatsApp.
 * CS menempel No. Pesanan (dari pesan WA pembeli), mengecek detailnya,
 * lalu satu klik konfirmasi: pesanan ditandai LUNAS dan top-up dieksekusi.
 * Detail (produk, tujuan, total) diambil otomatis dari database — tidak
 * perlu mengetik ulang. Pembeli memantau hasilnya di /topup/cek-status.
 */

type OrderInfo = {
  id: string;
  product_name: string;
  customer_no: string;
  amount: number;
  cost: number;
  buyer_name: string;
  buyer_phone: string;
  payment_status: string;
  topup_status: string;
  digiflazz_sn: string;
  error_message: string;
  created_at: string;
};

type PreviewRes =
  | {
      ok: true;
      preview: true;
      order: OrderInfo;
      saldo: { ok: boolean; balance?: number; error?: string };
      saldoCukup: boolean;
      catatan: string | null;
    }
  | { ok: false; error: string };

type ExecRes =
  | { ok: true; preview: false; step: string; detail: string; order?: OrderInfo }
  | { ok: false; error: string };

/** Warna badge status pembayaran/top-up. */
const statusBadge = (s: string) =>
  s === "paid" || s === "success"
    ? "bg-emerald-100 text-emerald-700"
    : s === "expired" || s === "failed"
      ? "bg-red-100 text-red-700"
      : s === "processing" || s === "pending" || s === "waiting_payment"
        ? "bg-amber-100 text-amber-700"
        : "bg-gray-100 text-gray-600";

/** Terjemahan status ke bahasa pembeli (dipakai juga di cek-status). */
const statusLabel = (s: string) =>
  s === "paid"
    ? "Sudah Dibayar"
    : s === "success"
      ? "Sukses"
      : s === "pending" || s === "processing"
        ? "Sedang Diproses"
        : s === "failed"
          ? "Gagal"
          : s === "expired"
            ? "Kedaluwarsa"
            : "Menunggu Pembayaran";

export default function TopUpAdminPage() {
  const [secret, setSecret] = useState("");
  const [orderId, setOrderId] = useState("");
  const [preview, setPreview] = useState<PreviewRes | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [exec, setExec] = useState<ExecRes | null>(null);
  const [execBusy, setExecBusy] = useState(false);
  const [error, setError] = useState("");

  // Ingat secret per sesi browser (bukan keamanan tinggi, cukup untuk gating).
  useEffect(() => {
    // Intentional one-time hydration of client-only state.
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = window.sessionStorage.getItem("topup-admin-secret");
    if (saved) setSecret(saved);
  }, []);

  /** Langkah 1: pratinjau pesanan + saldo (tanpa perubahan). */
  const doPreview = async () => {
    setPreviewBusy(true);
    setPreview(null);
    setExec(null);
    setError("");
    try {
      const res = await fetch("/api/topup/admin/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-topup-secret": secret },
        body: JSON.stringify({ orderId }),
      });
      setPreview((await res.json()) as PreviewRes);
    } catch (e) {
      setError("Jaringan bermasalah: " + String(e));
    } finally {
      setPreviewBusy(false);
    }
  };

  /** Langkah 2: tandai lunas + eksekusi top-up. */
  const doConfirm = async () => {
    setExecBusy(true);
    setExec(null);
    setError("");
    try {
      const res = await fetch("/api/topup/admin/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-topup-secret": secret },
        body: JSON.stringify({ orderId, confirm: true }),
      });
      setExec((await res.json()) as ExecRes);
    } catch (e) {
      setError("Jaringan bermasalah: " + String(e));
    } finally {
      setExecBusy(false);
    }
  };

  const pOrder = preview?.ok ? preview.order : null;
  const siapEksekusi =
    pOrder !== null &&
    pOrder.topup_status !== "success" &&
    pOrder.topup_status !== "failed";

  return (
    <div className="container-site py-5">
      <nav
        className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2"
        aria-label="Breadcrumb"
      >
        <span className="text-muted">Top Up Admin</span>
      </nav>

      <h1 className="text-xl font-bold text-ink sm:text-2xl">Proses Pesanan Top Up</h1>
      <p className="mt-1 text-sm text-muted">
        Tempel No. Pesanan dari pesan WhatsApp pembeli — detail diambil
        otomatis, lalu konfirmasi untuk menandai lunas dan mengeksekusi top-up.
      </p>

      <div className="mt-6 max-w-xl space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="ta-secret" className="mb-1.5 block text-sm font-semibold text-ink">
            Kode Admin
          </label>
          <input
            id="ta-secret"
            type="password"
            value={secret}
            onChange={(e) => {
              setSecret(e.target.value);
              window.sessionStorage.setItem("topup-admin-secret", e.target.value);
            }}
            placeholder="TOPUP_ADMIN_SECRET"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div>
          <label htmlFor="ta-order" className="mb-1.5 block text-sm font-semibold text-ink">
            No. Pesanan
          </label>
          <input
            id="ta-order"
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && secret && orderId) doPreview();
            }}
            placeholder="KTD-XXXXXXXXXX"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 font-mono text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <button
          type="button"
          onClick={doPreview}
          disabled={previewBusy || !secret || !orderId}
          className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {previewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Cek Pesanan
        </button>

        {error && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Langkah 1 selesai: kartu pratinjau pesanan. */}
        {preview && !preview.ok && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {preview.error === "pesanan_tidak_ditemukan"
              ? "Pesanan tidak ditemukan — periksa No. Pesanan."
              : preview.error === "forbidden"
                ? "Kode admin salah."
                : `Gagal: ${preview.error}`}
          </p>
        )}

        {preview?.ok && pOrder && (
          <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-bold text-ink">{pOrder.id}</p>
              <div className="flex gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge(pOrder.payment_status)}`}>
                  {statusLabel(pOrder.payment_status)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge(pOrder.topup_status)}`}>
                  {statusLabel(pOrder.topup_status)}
                </span>
              </div>
            </div>

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-2">Produk</dt>
                <dd className="font-semibold text-ink">{pOrder.product_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-2">Tujuan</dt>
                <dd className="font-mono font-semibold text-ink">{pOrder.customer_no}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-2">Total (dibayar pembeli)</dt>
                <dd className="font-semibold text-ink">{formatRupiah(pOrder.amount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-2">Modal</dt>
                <dd className="font-semibold text-ink">{formatRupiah(pOrder.cost)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-2">Pembeli</dt>
                <dd className="text-ink">
                  {pOrder.buyer_name} • {pOrder.buyer_phone || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-2">Saldo Digiflazz</dt>
                <dd className="flex items-center gap-1.5 font-semibold text-ink">
                  <Wallet className="h-3.5 w-3.5 text-muted-2" />
                  {preview.saldo.ok ? formatRupiah(preview.saldo.balance ?? 0) : `Gagal baca: ${preview.saldo.error}`}
                </dd>
              </div>
            </dl>

            {pOrder.digiflazz_sn && (
              <p className="break-all text-xs text-muted">
                SN: <span className="font-mono">{pOrder.digiflazz_sn}</span>
              </p>
            )}
            {pOrder.error_message && (
              <p className="text-xs text-red-600">{pOrder.error_message}</p>
            )}

            {preview.catatan && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {preview.catatan}
              </p>
            )}

            {pOrder.topup_status === "success" ? (
              <p className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Top-up pesanan ini sudah sukses — tidak perlu tindakan.
              </p>
            ) : pOrder.topup_status === "failed" ? (
              <p className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Top-up gagal — Digiflazz otomatis mengembalikan saldonya.
                Hubungi pembeli untuk pengembalian dana (CS manual).
              </p>
            ) : (
              <button
                type="button"
                onClick={doConfirm}
                disabled={execBusy || !siapEksekusi}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {execBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Konfirmasi Bayar &amp; Eksekusi Top Up
              </button>
            )}
          </div>
        )}

        {/* Langkah 2 selesai: hasil eksekusi. */}
        {exec && !exec.ok && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            Gagal: {exec.error}
          </p>
        )}
        {exec?.ok && (
          <div
            className={`rounded-xl border p-4 ${
              exec.step === "success"
                ? "border-emerald-100 bg-emerald-50"
                : exec.step === "failed"
                  ? "border-red-100 bg-red-50"
                  : "border-amber-100 bg-amber-50"
            }`}
          >
            <p
              className={`flex items-center gap-2 text-sm font-bold ${
                exec.step === "success"
                  ? "text-emerald-700"
                  : exec.step === "failed"
                    ? "text-red-700"
                    : "text-amber-700"
              }`}
            >
              {exec.step === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : exec.step === "failed" ? (
                <Info className="h-4 w-4" />
              ) : (
                <Loader2 className="h-4 w-4" />
              )}
              {exec.step === "success"
                ? "Top Up Sukses"
                : exec.step === "failed"
                  ? "Top Up Gagal"
                  : exec.step === "skipped"
                    ? "Tidak Ada Tindakan"
                    : "Status Pending"}
            </p>
            <p className="mt-1 text-sm text-muted">{exec.detail}</p>
            {exec.step === "success" && (
              <p className="mt-2 text-xs text-muted-2">
                Pembeli bisa mengecek statusnya di{" "}
                <a
                  href="/topup/cek-status"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand hover:underline"
                >
                  toko.kustoro2026.com/topup/cek-status
                </a>
                .
              </p>
            )}
            {exec.step === "pending" && (
              <p className="mt-2 text-xs text-muted-2">
                Sistem mengecek ulang otomatis setelah saldo cukup / layanan
                pulih. Klik "Cek Pesanan" lagi untuk status terbaru.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
