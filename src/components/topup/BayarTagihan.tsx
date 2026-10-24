"use client";

// Panel "Bayar Tagihan" di halaman /topup: pilih produk pascabayar (PDAM,
// PBB, PLN, BPJS, internet, TV, multifinance, dll) dari katalog efektif,
// masukkan nomor pelanggan, cek tagihan ke Digiflazz (inq-pasca), lalu
// lanjut bayar — rute /api/topup/pasca/* membuatkan baris pesanan sejak
// inquiry (ref_id terikat tagihan). Pembayaran memakai halaman umum
// /topup/bayar/{orderId} (QRIS) atau WhatsApp untuk nominal kecil.
//
// Data katalog seluruhnya dari server (statis + override DB) — klien hanya
// memanggil inquiry & lanjut bayar.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Droplets,
  ExternalLink,
  Flame,
  HeartPulse,
  Landmark,
  Loader2,
  ReceiptText,
  RotateCcw,
  Search,
  Smartphone,
  Tv,
  Wifi,
  Zap,
} from "lucide-react";
import { formatRupiah } from "@/lib/topup";
import {
  PASCA_CATEGORIES,
  type PascaCategoryId,
  type PascaCategoryInfo,
} from "@/lib/topup-pasca";
import type { EffectivePascaProduct } from "@/lib/topup-live";

/** Batas render daftar produk — katalog pasca ratusan SKU, cari lewat
 *  kategori + kata kunci agar DOM tetap ringan. */
const MAX_SHOWN = 80;

type Bill = {
  orderId: string;
  customerName: string;
  periode: string;
  price: number;
  admin: number;
  total: number;
  detail: Array<Record<string, unknown>>;
};

/** Ikon kategori — cabang JSX eksplisit agar tetap komponen statis. */
function categoryIcon(id: PascaCategoryId) {
  switch (id) {
    case "pln":
      return <Zap className="h-4 w-4" />;
    case "pdam":
      return <Droplets className="h-4 w-4" />;
    case "pbb":
      return <Landmark className="h-4 w-4" />;
    case "internet":
      return <Wifi className="h-4 w-4" />;
    case "tv":
      return <Tv className="h-4 w-4" />;
    case "hp":
      return <Smartphone className="h-4 w-4" />;
    case "bpjs":
      return <HeartPulse className="h-4 w-4" />;
    case "multifinance":
      return <Banknote className="h-4 w-4" />;
    case "gas":
      return <Flame className="h-4 w-4" />;
  }
}

/** Label baris rincian dari kunci objek Digiflazz (mis. nilai_tagihan). */
function detailLabel(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Nilai baris rincian — angka murni diformat rupiah (bukan periode). */
function detailValue(k: string, v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d+$/.test(s) && k.toLowerCase() !== "periode") {
    const n = Number(s);
    if (Number.isFinite(n) && n > 0) return formatRupiah(n);
  }
  return s;
}

export default function BayarTagihan({
  products,
  initialCategory,
}: {
  /** Katalog pasca efektif dari server (statis + override DB) — SKU mati
   *  hasil sinkron sudah tidak disertakan. */
  products: EffectivePascaProduct[];
  /** Kategori awal dari query ?kategori= (mis. dari tile di beranda). */
  initialCategory?: string | null;
}) {
  const router = useRouter();
  const cats = useMemo(
    () => PASCA_CATEGORIES.filter((c) => products.some((p) => p.category === c.id)),
    [products],
  );

  const [cat, setCat] = useState<PascaCategoryId | "all">(() =>
    initialCategory && PASCA_CATEGORIES.some((c) => c.id === initialCategory)
      ? (initialCategory as PascaCategoryId)
      : "all",
  );
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<EffectivePascaProduct | null>(null);
  const [no, setNo] = useState("");
  const [no2, setNo2] = useState("");
  const [busy, setBusy] = useState<"inquiry" | "order" | null>(null);
  const [err, setErr] = useState("");
  const [bill, setBill] = useState<Bill | null>(null);
  const [waInfo, setWaInfo] = useState<{ link: string; note: string } | null>(null);

  const lq = q.trim().toLowerCase();
  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          (cat === "all" || p.category === cat) &&
          (!lq ||
            p.name.toLowerCase().includes(lq) ||
            p.sku.toLowerCase().includes(lq) ||
            p.desc.toLowerCase().includes(lq)),
      ),
    [products, cat, lq],
  );

  const catInfo: PascaCategoryInfo | undefined = sel
    ? cats.find((c) => c.id === sel.category)
    : undefined;
  // PBB: nomor pelanggan = "Kode Pembayaran, Nomor Identitas" (dokumen
  // Digiflazz) — kolom kedua hanya muncul bila kategori punya secondLabel.
  const customerNo =
    sel && catInfo?.secondLabel
      ? `${no.trim()},${no2.trim()}`.replace(/^,\s*/, "")
      : no.trim();

  const pickProduct = (p: EffectivePascaProduct) => {
    setSel(p);
    setBill(null);
    setWaInfo(null);
    setErr("");
  };

  const doInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sel) return;
    const missing = !no.trim() || (catInfo?.secondLabel ? !no2.trim() : false);
    if (missing) {
      setErr(
        catInfo?.secondLabel
          ? "Isi kedua kolom nomor pelanggan dengan benar."
          : "Isi nomor pelanggan yang benar.",
      );
      return;
    }
    setErr("");
    setBusy("inquiry");
    try {
      const res = await fetch("/api/topup/pasca/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: sel.sku, customerNo }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setErr(
          j.message || (j.error === "sku_tidak_dikenal" ? "Produk sudah tidak tersedia." : j.error) ||
            "Gagal cek tagihan. Silakan coba lagi.",
        );
        return;
      }
      setBill({
        orderId: j.orderId,
        customerName: j.customerName || "",
        periode: j.periode || "",
        price: Number(j.price) || 0,
        admin: Number(j.admin) || 0,
        total: Number(j.total) || 0,
        detail: Array.isArray(j.detail) ? j.detail : [],
      });
    } catch {
      setErr("Jaringan bermasalah. Silakan coba lagi.");
    } finally {
      setBusy(null);
    }
  };

  const doPay = async () => {
    if (!bill) return;
    setErr("");
    setBusy("order");
    try {
      const res = await fetch("/api/topup/pasca/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: bill.orderId }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setErr(j.message || j.error || "Gagal membuat pembayaran. Silakan coba lagi.");
        return;
      }
      if (j.mode === "duitku") {
        router.push(`/topup/bayar/${j.orderId}`);
        return;
      }
      // Nominal kecil / gateway down — arahkan via WhatsApp CS.
      setWaInfo({
        link: j.waLink || "",
        note:
          j.gatewayError ||
          "Pembayaran nominal ini diproses via WhatsApp — CS siap memandu hingga selesai.",
      });
    } catch {
      setErr("Jaringan bermasalah. Silakan coba lagi.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section id="bayar-tagihan" className="mt-6 scroll-mt-24">
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        {/* Header panel */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <ReceiptText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-ink sm:text-xl">Bayar Tagihan</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">
                Cek &amp; bayar tagihan pascabayar — PDAM, PBB, PLN, BPJS, internet, TV, dan lainnya.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-muted-2">
            {products.length} produk
          </span>
        </div>

        {products.length === 0 ? (
          <p className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-muted">
            Produk bayar tagihan sedang tidak tersedia. Silakan coba lagi nanti.
          </p>
        ) : bill ? (
          /* ---------- Hasil inquiry: rincian tagihan + lanjut bayar ---------- */
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Tagihan Ditemukan
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-emerald-900">
              {bill.customerName && (
                <span>
                  <b>Nama:</b> {bill.customerName}
                </span>
              )}
              {bill.periode && (
                <span>
                  <b>Periode:</b> {bill.periode}
                </span>
              )}
            </div>

            {bill.detail.length > 0 && (
              <dl className="mt-3 divide-y divide-emerald-100 rounded-xl border border-emerald-100 bg-white">
                {bill.detail.map((row, i) => (
                  <div key={i} className="px-3.5 py-2">
                    {Object.entries(row)
                      .filter(([, v]) => String(v ?? "").trim() !== "")
                      .map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between gap-3 text-sm">
                          <dt className="text-muted">{detailLabel(k)}</dt>
                          <dd className="text-right font-medium text-ink">{detailValue(k, v)}</dd>
                        </div>
                      ))}
                  </div>
                ))}
              </dl>
            )}

            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-emerald-900/80">Tagihan</dt>
                <dd className="font-semibold text-ink">{formatRupiah(bill.price)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-emerald-900/80">Biaya Admin</dt>
                <dd className="font-semibold text-ink">{formatRupiah(bill.admin)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-emerald-100 pt-2">
                <dt className="font-bold text-emerald-900">Total Bayar</dt>
                <dd className="text-base font-extrabold text-brand">
                  {formatRupiah(bill.total)}
                </dd>
              </div>
            </dl>

            {waInfo ? (
              <div className="mt-3 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 p-3.5">
                <p className="text-sm leading-relaxed text-ink">{waInfo.note}</p>
                {waInfo.link && (
                  <a
                    href={waInfo.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1eb85a]"
                  >
                    Lanjut via WhatsApp <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={doPay}
                  disabled={busy === "order"}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === "order" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Membuat Pembayaran...
                    </>
                  ) : (
                    "Lanjut Bayar"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBill(null);
                    setWaInfo(null);
                    setErr("");
                  }}
                  disabled={busy === "order"}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-muted transition-colors hover:border-gray-300 hover:text-ink disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" /> Cek Ulang
                </button>
              </div>
            )}

            <p className="mt-2.5 text-center text-[11px] leading-relaxed text-emerald-800/70">
              Tagihan diproses otomatis ke penyedia setelah pembayaran terverifikasi.
            </p>
          </div>
        ) : (
          /* ---------- Pilih produk + nomor pelanggan ---------- */
          <>
            {/* Chip kategori — kolom ke bawah: mobile 2 kolom x 5 baris,
             *  sm 3 kolom x 4 baris, lg 4 kolom x 3 baris (3 ke bawah
             *  sampingnya 3 ke bawah dst.) — tanpa scroll horizontal. */}
            <div
              className="mt-4 grid grid-flow-col grid-rows-5 gap-2 sm:grid-rows-4 lg:grid-rows-3"
              role="tablist"
              aria-label="Kategori bayar tagihan"
            >
              <button
                type="button"
                onClick={() => setCat("all")}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                  cat === "all"
                    ? "bg-brand text-white"
                    : "border border-gray-200 bg-white text-muted hover:border-brand hover:text-brand"
                }`}
              >
                <span className="truncate">Semua</span>
              </button>
              {cats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCat(c.id)}
                  className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                    cat === c.id
                      ? "bg-brand text-white"
                      : "border border-gray-200 bg-white text-muted hover:border-brand hover:text-brand"
                  }`}
                >
                  <span className="shrink-0">{categoryIcon(c.id)}</span>
                  <span className="truncate">{c.label}</span>
                </button>
              ))}
            </div>

            {/* Pencarian produk */}
            <div className="mt-2 flex items-center overflow-hidden rounded-xl border border-gray-200 bg-white transition-colors focus-within:border-brand">
              <Search className="ml-3 h-4 w-4 shrink-0 text-muted-2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari produk tagihan — mis. PDAM, PBB, BPJS…"
                autoComplete="off"
                aria-label="Cari produk bayar tagihan"
                className="w-full bg-transparent px-2.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted-2"
              />
            </div>

            {/* Daftar produk */}
            <div className="mt-3 grid max-h-80 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
              {visible.slice(0, MAX_SHOWN).map((p) => (
                <button
                  key={p.sku}
                  type="button"
                  onClick={() => pickProduct(p)}
                  className={`flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                    sel?.sku === p.sku
                      ? "border-brand bg-brand/[0.04]"
                      : "border-gray-100 hover:border-brand/40 hover:bg-gray-50"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    {categoryIcon(p.category)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                    <span className="block truncate text-[11px] text-muted-2">
                      {p.desc || p.brand}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[10px] uppercase tracking-wide text-muted-2">
                      Admin
                    </span>
                    <span className="block text-xs font-bold text-ink">{formatRupiah(p.admin)}</span>
                  </span>
                </button>
              ))}
              {visible.length === 0 && (
                <p className="col-span-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-muted">
                  Tidak ada produk untuk kata kunci &ldquo;{q.trim()}&rdquo;.
                </p>
              )}
            </div>
            {visible.length > MAX_SHOWN && (
              <p className="mt-1.5 text-right text-[11px] text-muted-2">
                Menampilkan {MAX_SHOWN} dari {visible.length} produk — persempit
                pencarian untuk melihat lainnya.
              </p>
            )}

            {/* Produk terpilih + form nomor pelanggan */}
            {sel && (
              <form
                onSubmit={doInquiry}
                className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    {categoryIcon(sel.category)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{sel.name}</p>
                    <p className="truncate text-[11px] text-muted-2">
                      {sel.desc || sel.brand} • Biaya admin {formatRupiah(sel.admin)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-muted">
                      {catInfo?.targetLabel ?? "Nomor Pelanggan"}
                    </span>
                    <input
                      value={no}
                      onChange={(e) => setNo(e.target.value)}
                      placeholder="Contoh: 0123456789"
                      autoComplete="off"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand"
                    />
                  </label>
                  {catInfo?.secondLabel && (
                    <label className="block">
                      <span className="text-xs font-semibold text-muted">{catInfo.secondLabel}</span>
                      <input
                        value={no2}
                        onChange={(e) => setNo2(e.target.value)}
                        placeholder="Nomor identitas"
                        autoComplete="off"
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand"
                      />
                    </label>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={busy === "inquiry"}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {busy === "inquiry" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Mengecek Tagihan...
                    </>
                  ) : (
                    "Cek Tagihan"
                  )}
                </button>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-2">
                  Cek tagihan gratis — Anda hanya membayar setelah melihat rincian
                  tagihan.
                </p>
              </form>
            )}
          </>
        )}

        {/* Galat global (validasi / respons server) */}
        {err && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{err}</span>
          </p>
        )}
      </div>
    </section>
  );
}
