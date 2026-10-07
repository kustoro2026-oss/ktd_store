"use client";

// Halaman pilih nominal provider (pola halaman game itemku): header brand,
// tab kategori (bila provider lintas kategori), grid kartu nominal, dan panel
// beli sticky kanan (bawah di mobile). Alur pesanan sama dengan form lama:
// POST /api/topup/order → halaman bayar Duitku, atau fallback WhatsApp untuk
// nominal < Rp 10.000.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Info, Loader2, Send, ShieldCheck, Zap } from "lucide-react";
import {
  TOPUP_CATEGORIES,
  formatRupiah,
  type TopUpCategory,
  type TopUpNominal,
  type TopUpProvider,
} from "@/lib/topup";
import ProviderLogo from "./ProviderLogo";

type OrderResponse = {
  ok?: boolean;
  error?: string;
  orderId?: string;
  mode?: "duitku" | "wa";
  waLink?: string;
  gatewayError?: string;
};

type Props = {
  provider: TopUpProvider;
  /** SKU dari ?sku= (praseleksi nominal dari beranda). */
  initialSku?: string;
};

const WA_MIN = 10000;

export default function NominalPicker({ provider, initialSku }: Props) {
  const router = useRouter();

  // Kategori provider (urutan sesuai TOPUP_CATEGORIES).
  const catOrder = TOPUP_CATEGORIES.map((c) => c.id);
  const cats: TopUpCategory[] = [...new Set(provider.nominals.map((n) => n.category))].sort(
    (a, b) => catOrder.indexOf(a) - catOrder.indexOf(b),
  );

  const validInitial = provider.nominals.some((n) => n.sku === initialSku) ? initialSku : undefined;
  const [tab, setTab] = useState<TopUpCategory>(
    provider.nominals.find((n) => n.sku === validInitial)?.category ??
      provider.primaryCategory,
  );
  const [sku, setSku] = useState<string | null>(validInitial ?? null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [target, setTarget] = useState("");
  const [server, setServer] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Muat data pembeli terakhir untuk provider ini (localStorage klien).
    try {
      const raw = localStorage.getItem("ktd-topup-last:" + provider.slug);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          name?: string;
          phone?: string;
          target?: string;
          server?: string;
        };
        /* eslint-disable react-hooks/set-state-in-effect */
        setName(parsed.name ?? "");
        setPhone(parsed.phone ?? "");
        setTarget(parsed.target ?? "");
        setServer(parsed.server ?? "");
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // private mode / data rusak
    }
  }, [provider.slug]);

  const nominal = provider.nominals.find((n) => n.sku === sku) ?? null;
  const gridNominals = provider.nominals.filter((n) => n.category === tab);
  const isWaOnly = nominal !== null && nominal.sellPrice < WA_MIN;

  const remember = () => {
    try {
      localStorage.setItem(
        "ktd-topup-last:" + provider.slug,
        JSON.stringify({ name, phone, target, server }),
      );
    } catch {
      // private mode / quota
    }
  };

  const validate = (): string | null => {
    if (!nominal) return "Silakan pilih nominal terlebih dahulu.";
    if (!name.trim() || !target.trim())
      return `Mohon lengkapi Nama dan ${provider.customerNoLabel}.`;
    if (provider.needsServer && !server.trim())
      return "Mohon isi Server/Zone untuk produk Mobile Legends.";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/topup/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: nominal!.sku,
          id: target.trim(),
          server: server.trim(),
          buyerName: name.trim(),
          buyerPhone: phone.trim(),
        }),
      });
      const j = (await res.json()) as OrderResponse;
      if (j.ok && j.mode === "duitku" && j.orderId) {
        remember();
        router.push(`/topup/bayar/${j.orderId}`);
        return;
      }
      if (j.ok && j.mode === "wa" && j.orderId) {
        remember();
        if (j.waLink) window.open(j.waLink, "_blank", "noopener,noreferrer");
        setSent(true);
        return;
      }
      const messages: Record<string, string> = {
        sku_tidak_dikenal: "Produk yang dipilih tidak dikenali. Muat ulang halaman lalu coba lagi.",
        server_wajib: "Mohon isi Server/Zone untuk produk Mobile Legends.",
        gagal_menyimpan_pesanan: "Pesanan gagal disimpan. Silakan coba beberapa saat lagi.",
        bad_json: "Permintaan tidak valid. Silakan coba lagi.",
      };
      setError(messages[j.error ?? ""] ?? j.error ?? "Terjadi kesalahan. Silakan coba lagi.");
    } catch {
      setError("Jaringan bermasalah — periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const targetIsNumeric = provider.targetNumeric;

  if (sent && nominal) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <h2 className="text-lg font-bold text-ink">Pesanan Tercatat — WhatsApp Terbuka</h2>
        <p className="text-sm leading-relaxed text-muted">
          Pesanan top up Anda sudah tercatat. Lanjutkan pembayaran via WhatsApp
          yang terbuka: lampirkan bukti transfer dan CS kami akan memverifikasi,
          lalu pengisian diproses otomatis.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-2 rounded-xl border border-emerald-200 px-5 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          Buat Pesanan Lain
        </button>
      </div>
    );
  }

  return (
    <div className="pb-24 lg:pb-0">
      {/* Header brand */}
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-white shadow-sm sm:h-20 sm:w-20">
          <ProviderLogo slug={provider.slug} label={provider.label} className="h-11 w-11 sm:h-14 sm:w-14" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold text-ink sm:text-2xl">
            Top Up {provider.label}
          </h1>
          <p className="mt-0.5 text-xs text-muted sm:text-sm">
            Proses otomatis setelah pembayaran terverifikasi
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <span
                key={c}
                className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-semibold text-brand sm:text-[11px]"
              >
                {TOPUP_CATEGORIES.find((x) => x.id === c)?.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Kiri: tab + grid nominal */}
        <section className="min-w-0">
          {cats.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTab(c)}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                    tab === c
                      ? "border-brand bg-brand text-white"
                      : "border-gray-200 bg-white text-ink hover:border-brand hover:text-brand"
                  }`}
                >
                  {TOPUP_CATEGORIES.find((x) => x.id === c)?.label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
            {gridNominals.map((n) => (
              <NominalCard
                key={n.sku}
                n={n}
                selected={sku === n.sku}
                onSelect={() => setSku(n.sku)}
              />
            ))}
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            Pastikan {provider.customerNoLabel.toLowerCase()} yang Anda isi benar —
            pengisian ke nomor/ID yang salah tidak dapat dikembalikan.
          </p>
        </section>

        {/* Kanan: panel beli sticky */}
        <form
          id="topup-buy-form"
          onSubmit={submit}
          noValidate
          className="min-w-0 space-y-4 self-start rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:sticky lg:top-24"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
              Nominal Dipilih
            </p>
            {nominal ? (
              <div className="mt-1.5">
                <p className="text-base font-bold text-ink">{nominal.name}</p>
                {nominal.type && (
                  <span className="mt-1 inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-muted">
                    {nominal.type}
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-muted">Pilih nominal di samping kiri.</p>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="np-name" className="mb-1.5 block text-sm font-semibold text-ink">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input
                id="np-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama pemesan"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-base outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="np-phone" className="mb-1.5 block text-sm font-semibold text-ink">
                No. HP Pemesan
              </label>
              <input
                id="np-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xxxxxxxxxx (untuk notifikasi WhatsApp)"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-base outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="np-target" className="mb-1.5 block text-sm font-semibold text-ink">
                {provider.customerNoLabel} <span className="text-red-500">*</span>
              </label>
              <input
                id="np-target"
                type="text"
                inputMode={targetIsNumeric ? "numeric" : "text"}
                value={target}
                onChange={(e) =>
                  setTarget(targetIsNumeric ? e.target.value.replace(/\D/g, "") : e.target.value)
                }
                placeholder={
                  provider.customerNoLabel.toLowerCase().includes("hp")
                    ? "08xxxxxxxxxx"
                    : "Contoh: 12345678"
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-base outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-sm"
              />
            </div>
            {provider.needsServer && (
              <div>
                <label htmlFor="np-server" className="mb-1.5 block text-sm font-semibold text-ink">
                  Server / Zone <span className="text-red-500">*</span>
                </label>
                <input
                  id="np-server"
                  type="text"
                  inputMode="numeric"
                  value={server}
                  onChange={(e) => setServer(e.target.value.replace(/\D/g, ""))}
                  placeholder="Contoh: 1234"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-base outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-sm"
                />
              </div>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600"
            >
              {error}
            </p>
          )}

          {isWaOnly && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs leading-relaxed text-amber-800">
                Nominal di bawah Rp 10.000 (minimum pembayaran online) diproses
                via WhatsApp — pesanan tetap tercatat dan CS kami akan
                memverifikasi pembayaran Anda.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div>
              <p className="text-xs text-muted-2">Total Pembayaran</p>
              <p className="text-xl font-extrabold text-brand">
                {nominal ? formatRupiah(nominal.sellPrice) : "—"}
              </p>
            </div>
            <button
              type="submit"
              disabled={busy || !nominal}
              className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {busy ? "Memproses..." : "Beli Sekarang"}
            </button>
          </div>

          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            Bayar via QRIS / Virtual Account — pengisian otomatis setelah
            pembayaran terverifikasi, biasanya dalam beberapa menit.
          </p>
        </form>
      </div>

      {/* Bar bawah sticky (mobile): ringkasan + tombol submit form panel */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-gray-100 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] lg:hidden">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-ink">
            {nominal ? nominal.name : "Pilih nominal"}
          </p>
          <p className="text-sm font-extrabold text-brand">
            {nominal ? formatRupiah(nominal.sellPrice) : "—"}
          </p>
        </div>
        <button
          type="submit"
          form="topup-buy-form"
          disabled={busy || !nominal}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? "Memproses..." : "Beli"}
        </button>
      </div>
    </div>
  );
}

function NominalCard({
  n,
  selected,
  onSelect,
}: {
  n: TopUpNominal;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`min-w-0 rounded-2xl border p-3 text-left transition-colors sm:p-4 ${
        selected
          ? "border-brand bg-brand/5 ring-2 ring-brand/20"
          : "border-gray-200 bg-white hover:border-brand/60"
      }`}
    >
      <p className="truncate text-sm font-semibold leading-snug text-ink">{n.name}</p>
      {n.type && (
        <span className="mt-1.5 inline-block max-w-full truncate rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-muted">
          {n.type}
        </span>
      )}
      <p className="mt-2 text-base font-extrabold text-brand">{formatRupiah(n.sellPrice)}</p>
    </button>
  );
}
