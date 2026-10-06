"use client";

import { useEffect, useState } from "react";
import { Loader2, Play, RefreshCw, Wallet } from "lucide-react";
import { TOPUP_PRODUCTS, customerNoFor, formatRupiah } from "@/lib/topup";

/**
 * Halaman admin eksekusi top-up (internal CS).
 * Alur: CS memverifikasi pembayaran dari pesan WhatsApp pembeli, lalu
 * mengisi SKU + ID (+ server) di sini dan klik Eksekusi. Request diteruskan
 * ke /api/topup/execute yang menandatangani dan mengirim ke Digiflazz.
 */

type Result = { ok?: boolean; status?: number; error?: string; data?: unknown; detail?: string };

export default function TopUpAdminPage() {
  const [secret, setSecret] = useState("");
  const [sku, setSku] = useState(TOPUP_PRODUCTS[0].sku);
  const [gameId, setGameId] = useState("");
  const [server, setServer] = useState("");
  const [refId, setRefId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [saldo, setSaldo] = useState<string | null>(null);

  // Ingat secret per sesi browser (bukan keamanan tinggi, cukup untuk gating).
  useEffect(() => {
    // Intentional one-time hydration of client-only state.
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = window.sessionStorage.getItem("topup-admin-secret");
    if (saved) setSecret(saved);
  }, []);

  const product = TOPUP_PRODUCTS.find((p) => p.sku === sku) ?? TOPUP_PRODUCTS[0];
  const customerNo = customerNoFor(product, gameId, server);

  const doExecute = async () => {
    setBusy(true);
    setResult(null);
    const ref = refId.trim() || `KTD-${Date.now()}`;
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
      const d = j?.data?.data;
      setSaldo(typeof d?.deposit === "number" ? formatRupiah(d.deposit) : JSON.stringify(j));
    } catch (e) {
      setSaldo("Gagal: " + String(e));
    } finally {
      setBusy(false);
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

      <h1 className="text-xl font-bold text-ink sm:text-2xl">Eksekusi Top Up (Admin)</h1>
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
              {TOPUP_PRODUCTS.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.sku} — {p.name} ({formatRupiah(p.sellPrice)})
                </option>
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
              ID Game
            </label>
            <input
              id="ta-id"
              type="text"
              inputMode="numeric"
              value={gameId}
              onChange={(e) => setGameId(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          {product.needsServer && (
            <div>
              <label htmlFor="ta-server" className="mb-1.5 block text-sm font-semibold text-ink">
                Server / Zone
              </label>
              <input
                id="ta-server"
                type="text"
                inputMode="numeric"
                value={server}
                onChange={(e) => setServer(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
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
            disabled={busy || !customerNo}
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
    </div>
  );
}
