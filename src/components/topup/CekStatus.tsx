"use client";

// Halaman cek status + riwayat pesanan top-up (gap kepercayaan): masukkan
// No. HP atau ID pesanan — status live diambil dari /api/topup/cek.
import { useState } from "react";
import Link from "next/link";
import { Clock3, Loader2, Search, ShieldCheck } from "lucide-react";
import { formatRupiah } from "@/lib/topup";

type StatusKey = "menunggu" | "diproses" | "sukses" | "gagal";

type PublicOrder = {
  id: string;
  product: string;
  target: string;
  amount: number;
  status: { key: StatusKey; label: string };
  createdAt: string;
  canPay: boolean;
};

const STATUS_STYLE: Record<StatusKey, string> = {
  menunggu: "border-amber-200 bg-amber-50 text-amber-700",
  diproses: "border-sky-200 bg-sky-50 text-sky-700",
  sukses: "border-emerald-200 bg-emerald-50 text-emerald-700",
  gagal: "border-red-200 bg-red-50 text-red-700",
};

/** "0812..." / "+62812..." → pencarian riwayat; selain itu ID pesanan. */
function looksLikePhone(input: string): boolean {
  const t = input.replace(/\s+/g, "");
  return /^(\+?62|0)8\d{7,}$/.test(t);
}

function formatWib(utc: string): string {
  const d = new Date(utc.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return utc;
  return d.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

function StatusBadge({ status }: { status: PublicOrder["status"] }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status.key]}`}
    >
      {status.label}
    </span>
  );
}

export default function CekStatus() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ order?: PublicOrder; orders?: PublicOrder[] } | null>(
    null,
  );

  const cek = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    setError("");
    setResult(null);
    if (!q) {
      setError("Masukkan No. HP atau ID pesanan terlebih dahulu.");
      return;
    }
    setBusy(true);
    try {
      const param = looksLikePhone(q)
        ? `phone=${encodeURIComponent(q)}`
        : `order=${encodeURIComponent(q)}`;
      const res = await fetch(`/api/topup/cek?${param}`);
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        order?: PublicOrder;
        orders?: PublicOrder[];
      };
      if (res.status === 404) {
        setError("Pesanan tidak ditemukan — periksa kembali ID pesanan Anda.");
      } else if (!j.ok) {
        setError("Terjadi kesalahan. Silakan coba lagi.");
      } else if (j.order) {
        setResult({ order: j.order });
      } else {
        setResult({ orders: j.orders ?? [] });
      }
    } catch {
      setError("Jaringan bermasalah — periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-extrabold text-ink sm:text-2xl">Cek Status Pesanan</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Pantau status top up Anda secara live — masukkan No. HP untuk melihat
        riwayat, atau ID pesanan untuk status satu transaksi.
      </p>

      <form onSubmit={cek} className="mt-5 flex max-w-xl gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="No. HP (08xxx) atau ID pesanan (KTD-xxx)"
          autoComplete="off"
          enterKeyHint="search"
          aria-label="No. HP atau ID pesanan"
          className="min-w-0 w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="hidden sm:inline">{busy ? "Memeriksa..." : "Cek Status"}</span>
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-4 max-w-xl rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600"
        >
          {error}
        </p>
      )}

      {/* Hasil satu pesanan */}
      {result?.order && (
        <div className="mt-6 max-w-xl rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink">{result.order.id}</p>
            <StatusBadge status={result.order.status} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-2">Produk</dt>
              <dd className="text-right font-medium text-ink">{result.order.product}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-2">Tujuan</dt>
              <dd className="font-mono text-ink">{result.order.target}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-2">Total</dt>
              <dd className="font-extrabold text-brand">{formatRupiah(result.order.amount)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-2">Waktu</dt>
              <dd className="text-ink">{formatWib(result.order.createdAt)}</dd>
            </div>
          </dl>
          {result.order.canPay && (
            <Link
              href={`/topup/bayar/${result.order.id}`}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-2"
            >
              <Clock3 className="h-4 w-4" />
              Lanjut Bayar
            </Link>
          )}
        </div>
      )}

      {/* Riwayat per No. HP */}
      {result?.orders && (
        <div className="mt-6 max-w-2xl">
          {result.orders.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-ink">Belum ada transaksi</p>
              <p className="mt-1 text-xs text-muted">
                Tidak ditemukan pesanan untuk nomor tersebut. Mulai top up pertama
                Anda di halaman Top Up.
              </p>
              <Link
                href="/topup"
                className="mt-3 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-2"
              >
                Mulai Top Up
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm font-bold text-ink">
                Riwayat Transaksi{" "}
                <span className="font-normal text-muted-2">
                  ({result.orders.length} transaksi terakhir)
                </span>
              </p>
              <ul className="mt-3 space-y-2">
                {result.orders.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{o.product}</p>
                      <p className="mt-0.5 text-xs text-muted-2">
                        {formatWib(o.createdAt)} • Tujuan {o.target}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-extrabold text-brand">
                        {formatRupiah(o.amount)}
                      </span>
                      <StatusBadge status={o.status} />
                      {o.canPay && (
                        <Link
                          href={`/topup/bayar/${o.id}`}
                          className="text-xs font-bold text-brand underline-offset-2 hover:underline"
                        >
                          Bayar
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <p className="mt-8 flex max-w-xl items-start gap-2 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        Demi keamanan, nomor tujuan ditampilkan tersamar. Status diperbarui
        otomatis oleh sistem pembayaran — bila status tidak berubah lebih dari
        15 menit, hubungi CS kami via WhatsApp.
      </p>
    </div>
  );
}
