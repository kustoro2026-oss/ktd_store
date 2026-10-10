"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, RefreshCw, Wallet } from "lucide-react";
import { TOPUP_CATEGORIES, TOPUP_PRODUCTS, formatRupiah, providerForSku } from "@/lib/topup";
import { fieldsForProvider } from "@/lib/topup-fields";

/**
 * Halaman admin eksekusi top-up (internal CS).
 * Alur: CS memverifikasi pembayaran dari pesan WhatsApp pembeli, lalu
 * mengisi SKU + ID (+ server) di sini dan klik Eksekusi. Request diteruskan
 * ke /api/topup/execute yang menandatangani dan mengirim ke Digiflazz.
 */

type Result = { ok?: boolean; status?: number; error?: string; data?: unknown; detail?: string };

type OrderRow = {
  id: string;
  product_name: string;
  customer_no: string;
  amount: number;
  cost: number;
  buyer_name: string;
  buyer_phone: string;
  payment_status: string;
  topup_status: string;
  paid_at: string;
  digiflazz_sn: string;
  error_message: string;
  created_at: string;
};

/** Warna badge status pembayaran/top-up. */
const statusBadge = (s: string) =>
  s === "paid" || s === "success"
    ? "bg-emerald-100 text-emerald-700"
    : s === "expired" || s === "failed"
      ? "bg-red-100 text-red-700"
      : s === "processing" || s === "pending"
        ? "bg-amber-100 text-amber-700"
        : "bg-gray-100 text-gray-600";

/** Ref idempoten bawaan eksekusi manual (dibuat saat klik, bukan render). */
const defaultRefId = () => `KTD-${Date.now()}`;

export default function TopUpAdminPage() {
  const [secret, setSecret] = useState("");
  const [sku, setSku] = useState(TOPUP_PRODUCTS[0].sku);
  const [gameId, setGameId] = useState("");
  const [server, setServer] = useState("");
  const [refId, setRefId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [saldo, setSaldo] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersBusy, setOrdersBusy] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [rechecking, setRechecking] = useState(false);
  const [recheckMsg, setRecheckMsg] = useState("");

  // Ingat secret per sesi browser (bukan keamanan tinggi, cukup untuk gating).
  useEffect(() => {
    // Intentional one-time hydration of client-only state.
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = window.sessionStorage.getItem("topup-admin-secret");
    if (saved) setSecret(saved);
  }, []);

  const product = TOPUP_PRODUCTS.find((p) => p.sku === sku) ?? TOPUP_PRODUCTS[0];
  // Susun customer_no lewat skema yang sama dengan form pembeli (single
  // source of truth) — ML = "id zone", Genshin/HSR = "UID|Server", dsb.
  const provider = providerForSku(product.sku);
  const schema = provider ? fieldsForProvider(provider.slug) : null;
  const serverField = schema?.fields.find((f) => f.key === "server");
  const customerNo = schema
    ? schema.compose({ target: gameId, server, nickname: "" })
    : gameId.trim();
  // Nomor pelanggan (K-Vision) dibiarkan teks bebas; lainnya angka saja.
  const targetIsNumeric = product.customerNoLabel !== "Nomor Pelanggan";

  const doExecute = async () => {
    setBusy(true);
    setResult(null);
    const ref = refId.trim() || defaultRefId();
    if (!refId.trim()) setRefId(ref);
    try {
      const res = await fetch("/api/topup/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-topup-secret": secret },
        body: JSON.stringify({ sku: product.sku, customerNo, refId: ref }),
      });
      setResult(await res.json());
    } catch (e) {
      setResult({ ok: false, error: "network", detail: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const doCekSaldo = async () => {
    setBusy(true);
    setSaldo(null);
    try {
      const res = await fetch("/api/topup/cek-saldo", {
        headers: { "x-topup-secret": secret },
      });
      const j = await res.json();
      setSaldo(typeof j?.balance === "number" ? formatRupiah(j.balance) : JSON.stringify(j));
    } catch (e) {
      setSaldo("Gagal: " + String(e));
    } finally {
      setBusy(false);
    }
  };

  /** Muat daftar pesanan terbaru (dilindungi x-topup-secret). */
  const loadOrders = useCallback(async () => {
    if (!secret) return;
    setOrdersBusy(true);
    setOrdersError("");
    try {
      const res = await fetch("/api/topup/orders", {
        headers: { "x-topup-secret": secret },
        cache: "no-store",
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        setOrders((j.orders as OrderRow[]) ?? []);
      } else {
        setOrdersError(j?.error === "forbidden" ? "Kode admin salah." : "Gagal memuat pesanan.");
      }
    } catch {
      setOrdersError("Jaringan bermasalah saat memuat pesanan.");
    } finally {
      setOrdersBusy(false);
    }
  }, [secret]);

  // Muat saat secret tersedia, lalu segarkan tiap 60 detik.
  useEffect(() => {
    loadOrders();
    const t = setInterval(loadOrders, 60_000);
    return () => clearInterval(t);
  }, [loadOrders]);

  /** Cek ulang transaksi Digiflazz yang masih Pending (idempoten) +
   *  tandai pesanan gateway yang kedaluwarsa. */
  const doRecheckPending = async () => {
    setRechecking(true);
    setRecheckMsg("");
    try {
      const res = await fetch("/api/topup/cron/pending", {
        headers: { "x-topup-secret": secret },
        cache: "no-store",
      });
      const j = await res.json();
      if (j.ok) {
        setRecheckMsg(
          `${j.expired} pesanan kedaluwarsa • ${j.rechecked} transaksi Pending dicek ulang.`,
        );
        loadOrders();
      } else {
        setRecheckMsg(`Gagal: ${j.error ?? "tidak diketahui"}`);
      }
    } catch {
      setRecheckMsg("Gagal: jaringan bermasalah.");
    } finally {
      setRechecking(false);
    }
  };

  const data = result?.data as
    | { data?: { status?: string; message?: string; sn?: string; price?: number } }
    | undefined;
  const inner = data?.data;

  return (
    <div className="container-site py-5">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <span className="text-muted">Top Up Admin</span>
      </nav>

      <h1 className="text-xl font-bold text-ink sm:text-2xl">Eksekusi Top Up & Isi Saldo (Admin)</h1>
      <p className="mt-1 text-sm text-muted">
        Halaman internal CS: eksekusi top-up setelah pembayaran terverifikasi.
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ta-sku" className="mb-1.5 block text-sm font-semibold text-ink">
              Produk (SKU)
            </label>
            <select
              id="ta-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              {TOPUP_CATEGORIES.map((c) => (
                <optgroup key={c.id} label={c.label}>
                  {TOPUP_PRODUCTS.filter((p) => p.category === c.id).map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.sku} — {p.name} ({formatRupiah(p.sellPrice)})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ta-ref" className="mb-1.5 block text-sm font-semibold text-ink">
              Ref ID <span className="font-normal text-muted-2">(kosongkan = baru; isi ulang = cek status)</span>
            </label>
            <input
              id="ta-ref"
              type="text"
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
              placeholder="KTD-..."
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ta-id" className="mb-1.5 block text-sm font-semibold text-ink">
              {product.customerNoLabel}
            </label>
            <input
              id="ta-id"
              type="text"
              inputMode={targetIsNumeric ? "numeric" : "text"}
              value={gameId}
              onChange={(e) =>
                setGameId(targetIsNumeric ? e.target.value.replace(/\D/g, "") : e.target.value)
              }
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          {serverField && (
            <div>
              <label htmlFor="ta-server" className="mb-1.5 block text-sm font-semibold text-ink">
                {serverField.label}
              </label>
              {serverField.options ? (
                <select
                  id="ta-server"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  <option value="" disabled>
                    {serverField.placeholder}
                  </option>
                  {serverField.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="ta-server"
                  type="text"
                  inputMode={serverField.numeric ? "numeric" : "text"}
                  value={server}
                  onChange={(e) =>
                    setServer(
                      serverField.numeric ? e.target.value.replace(/\D/g, "") : e.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              )}
            </div>
          )}
        </div>

        <p className="rounded-xl bg-gray-50 px-4 py-2.5 text-xs text-muted">
          customer_no yang akan dikirim: <span className="font-mono font-semibold text-ink">{customerNo || "—"}</span>
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={doExecute}
            disabled={busy || !customerNo || (serverField ? !server : false)}
            className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Eksekusi Top Up
          </button>
          <button
            type="button"
            onClick={doCekSaldo}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
          >
            <Wallet className="h-4 w-4" />
            Cek Saldo
          </button>
        </div>

        {saldo && (
          <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
            Saldo Digiflazz: {saldo}
          </p>
        )}

        {result && (
          <div className={`rounded-xl border p-4 ${result.ok ? "border-gray-200 bg-gray-50" : "border-red-100 bg-red-50"}`}>
            <p className="text-sm font-bold text-ink">
              {result.error ? `Error: ${result.error}` : `HTTP ${result.status}`}
            </p>
            {inner && (
              <div className="mt-2 space-y-1 text-sm">
                <p className={inner.status === "Sukses" ? "font-semibold text-emerald-600" : inner.status === "Pending" ? "font-semibold text-amber-600" : "font-semibold text-red-600"}>
                  Status: {inner.status}
                </p>
                {inner.message && <p className="text-muted">Pesan: {inner.message}</p>}
                {inner.sn && <p className="break-all text-muted">SN: {inner.sn}</p>}
                {typeof inner.price === "number" && <p className="text-muted">Harga: {formatRupiah(inner.price)}</p>}
                {inner.status === "Pending" && (
                  <p className="text-xs text-muted-2">
                    Jika Pending, klik Eksekusi lagi dengan Ref ID yang sama untuk memeriksa
                    status terbaru (idempoten, tidak membuat transaksi ganda).
                  </p>
                )}
              </div>
            )}
            {!inner && <p className="mt-1 break-all text-xs text-muted">{JSON.stringify(result)}</p>}
          </div>
        )}

        <button
          type="button"
          onClick={() => setResult(null)}
          className="flex items-center gap-1 text-xs font-semibold text-muted-2 transition-colors hover:text-brand"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reset Hasil
        </button>
      </div>

      {/* Pesanan terbaru + cek ulang Pending */}
      <section className="mt-8 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">Pesanan Terbaru</h2>
            <p className="mt-0.5 text-xs text-muted">
              Diperbarui otomatis tiap 60 detik. Transaksi Digiflazz Pending
              dicek ulang lewat tombol di samping (kirim ulang ref_id sama).
            </p>
          </div>
          <button
            type="button"
            onClick={doRecheckPending}
            disabled={rechecking || !secret}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {rechecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Cek Ulang Pending
          </button>
        </div>

        {recheckMsg && (
          <p className="mt-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-2 text-xs text-sky-700">
            {recheckMsg}
          </p>
        )}
        {ordersError && (
          <p className="mt-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
            {ordersError}
          </p>
        )}

        <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          {ordersBusy && orders.length === 0 ? (
            <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat pesanan...
            </p>
          ) : orders.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">
              Belum ada pesanan. Masukkan kode admin yang benar untuk melihat daftar.
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-muted-2">
                <tr>
                  <th className="px-4 py-3 font-semibold">Waktu (UTC)</th>
                  <th className="px-4 py-3 font-semibold">Pesanan</th>
                  <th className="px-4 py-3 font-semibold">Tujuan</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Bayar</th>
                  <th className="px-4 py-3 font-semibold">Top Up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o) => (
                  <tr key={o.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">
                      {o.created_at.slice(5, 16)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{o.id}</p>
                      <p className="text-xs text-muted">{o.product_name}</p>
                      <p className="text-xs text-muted-2">
                        {o.buyer_name} • {o.buyer_phone || "-"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink">
                      {o.customer_no}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-semibold text-ink">{formatRupiah(o.amount)}</p>
                      <p className="text-xs text-muted-2">modal {formatRupiah(o.cost)}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge(o.payment_status)}`}
                      >
                        {o.payment_status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge(o.topup_status)}`}
                      >
                        {o.topup_status}
                      </span>
                      {o.error_message && (
                        <p
                          className="mt-1 max-w-[180px] truncate text-[11px] text-red-500"
                          title={o.error_message}
                        >
                          {o.error_message}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
