"use client";

// Halaman pilih nominal provider (pola halaman game itemku): header brand,
// tab kategori tersegmen (bila provider lintas kategori), pencarian nominal,
// grid kartu nominal bertahap (load more), dan panel beli sticky kanan
// (bawah di mobile). Alur pesanan sama dengan form lama:
// POST /api/topup/order → halaman bayar Duitku, atau fallback WhatsApp untuk
// nominal < Rp 10.000.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Info,
  Loader2,
  Search,
  Send,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  TOPUP_CATEGORIES,
  formatRupiah,
  type TopUpCategory,
  type TopUpNominal,
  type TopUpProvider,
} from "@/lib/topup";
import ProviderLogo from "./ProviderLogo";
import { fieldsForProvider } from "@/lib/topup-fields";

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
/** Jumlah kartu nominal yang dirender sekali jalan (grid bisa ribuan baris). */
const BASE_SHOW = 48;
const SHOW_STEP = 48;

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
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nomFilter, setNomFilter] = useState("");
  const [visibleCount, setVisibleCount] = useState(BASE_SHOW);

  // Skema input provider (field per produk ala itemku) + ikon item nominal.
  const schema = fieldsForProvider(provider.slug);

  const fieldValue = (key: string): string => {
    if (key === "server") return server;
    if (key === "nickname") return nickname;
    return target;
  };
  const setFieldValue = (key: string, v: string) => {
    if (key === "server") setServer(v);
    else if (key === "nickname") setNickname(v);
    else setTarget(v);
  };

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
          nickname?: string;
        };
        /* eslint-disable react-hooks/set-state-in-effect */
        setName(parsed.name ?? "");
        setPhone(parsed.phone ?? "");
        setTarget(parsed.target ?? "");
        setServer(parsed.server ?? "");
        setNickname(parsed.nickname ?? "");
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // private mode / data rusak
    }
  }, [provider.slug]);

  useEffect(() => {
    // Reset pencarian + batas tampil saat ganti provider/tab; pastikan nominal
    // praseleksi dari ?sku= ikut terlihat di grid.
    setNomFilter("");
    if (validInitial) {
      const list = provider.nominals.filter((n) => n.category === tab);
      const idx = list.findIndex((n) => n.sku === validInitial);
      setVisibleCount(idx >= 0 ? Math.max(BASE_SHOW, idx + 1) : BASE_SHOW);
    } else {
      setVisibleCount(BASE_SHOW);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.slug, tab]);

  const selectTab = (c: TopUpCategory) => {
    setTab(c);
    setNomFilter("");
    setVisibleCount(BASE_SHOW);
  };

  const nominal = provider.nominals.find((n) => n.sku === sku) ?? null;
  const gridNominals = provider.nominals.filter((n) => n.category === tab);
  const q = nomFilter.trim().toLowerCase();
  const filtered = q
    ? gridNominals.filter(
        (n) => n.name.toLowerCase().includes(q) || n.sku.toLowerCase().includes(q),
      )
    : gridNominals;
  const visible = filtered.slice(0, visibleCount);
  const isWaOnly = nominal !== null && nominal.sellPrice < WA_MIN;

  const remember = () => {
    try {
      localStorage.setItem(
        "ktd-topup-last:" + provider.slug,
        JSON.stringify({ name, phone, target, server, nickname }),
      );
    } catch {
      // private mode / quota
    }
  };

  const validate = (): string | null => {
    if (!nominal) return "Silakan pilih nominal terlebih dahulu.";
    if (!name.trim()) return "Mohon lengkapi Nama pemesan.";
    for (const f of schema.fields) {
      const val = fieldValue(f.key).trim();
      if (!val) {
        if (!f.optional) return `Mohon isi ${f.label}.`;
        continue;
      }
      if (f.numeric && !/^\d+$/.test(val)) return `${f.label} harus berupa angka.`;
      if (f.minLength && val.length < f.minLength)
        return `${f.label} terlalu pendek (min. ${f.minLength} digit).`;
      if (f.maxLength && val.length > f.maxLength)
        return `${f.label} terlalu panjang (maks. ${f.maxLength} karakter).`;
    }
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
          nickname: nickname.trim(),
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
        layanan_sibuk: "Layanan sedang sibuk, silakan coba lagi beberapa saat lagi.",
      };
      setError(messages[j.error ?? ""] ?? j.error ?? "Terjadi kesalahan. Silakan coba lagi.");
    } catch {
      setError("Jaringan bermasalah — periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  };

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
    <div className="pb-2 lg:pb-0">
      {/* Header brand */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-brand/[0.07] via-white to-transparent p-4 shadow-sm sm:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-brand/10 blur-2xl"
        />
        <div className="relative flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm sm:h-20 sm:w-20">
            <ProviderLogo
              slug={provider.slug}
              label={provider.label}
              className="h-10 w-10 sm:h-12 sm:w-12"
            />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
              Top Up {provider.label}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted sm:text-sm">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                Pembayaran terverifikasi
              </span>
              <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-gray-300 sm:inline-block" />
              <span>Pengisian otomatis</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
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
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Kiri: tab + grid nominal */}
        <section className="min-w-0">
          {cats.length > 1 && (
            <div className="scrollbar-hide -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-gray-100/70 p-1 sm:mx-0">
              {cats.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => selectTab(c)}
                  className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    tab === c ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {TOPUP_CATEGORIES.find((x) => x.id === c)?.label}
                </button>
              ))}
            </div>
          )}

          {/* Pencarian nominal */}
          {gridNominals.length > 24 && (
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
              <input
                type="search"
                value={nomFilter}
                onChange={(e) => {
                  setNomFilter(e.target.value);
                  setVisibleCount(BASE_SHOW);
                }}
                placeholder={`Cari nominal ${provider.label}…`}
                autoComplete="off"
                aria-label={`Cari nominal ${provider.label}`}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          )}

          <p className="mt-4 text-xs text-muted-2">
            Menampilkan{" "}
            <b className="font-semibold text-muted">{visible.length}</b> dari{" "}
            <b className="font-semibold text-muted">{filtered.length}</b> nominal
            {q ? <> untuk &ldquo;{nomFilter.trim()}&rdquo;</> : null}
          </p>

          {filtered.length === 0 ? (
            <p className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-6 text-center text-sm text-muted">
              Tidak ada nominal yang cocok dengan &ldquo;{nomFilter.trim()}&rdquo;.
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                {visible.map((n) => (
                  <NominalCard
                    key={n.sku}
                    n={n}
                    icon={schema.icon}
                    selected={sku === n.sku}
                    onSelect={() => setSku(n.sku)}
                  />
                ))}
              </div>
              {filtered.length > visible.length && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((v) => v + SHOW_STEP)}
                    className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-brand transition-colors hover:border-brand hover:bg-brand/[0.04]"
                  >
                    Tampilkan Lebih Banyak
                    <span className="ml-1.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-muted">
                      +{Math.min(SHOW_STEP, filtered.length - visible.length)}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}

          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            Pastikan {schema.fields[0]?.label.toLowerCase() ?? "ID tujuan"} yang Anda isi
            benar — pengisian ke nomor/ID yang salah tidak dapat dikembalikan.
          </p>
        </section>

        {/* Kanan: panel beli sticky */}
        <form
          id="topup-buy-form"
          onSubmit={submit}
          noValidate
          className="min-w-0 self-start overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lg:sticky lg:top-24"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
              <ProviderLogo slug={provider.slug} label={provider.label} className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{provider.label}</p>
              <p className="text-[11px] text-muted-2">Pengisian otomatis terverifikasi</p>
            </div>
          </div>

          <div className="space-y-4 p-5">
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
              {schema.fields.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`np-${f.key}`} className="mb-1.5 block text-sm font-semibold text-ink">
                    {f.label} {!f.optional && <span className="text-red-500">*</span>}
                  </label>
                  {f.options ? (
                    <select
                      id={`np-${f.key}`}
                      value={fieldValue(f.key)}
                      onChange={(e) => setFieldValue(f.key, e.target.value)}
                      className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-base outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-sm"
                    >
                      <option value="" disabled>
                        {f.placeholder}
                      </option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`np-${f.key}`}
                      type="text"
                      inputMode={f.numeric ? "numeric" : "text"}
                      value={fieldValue(f.key)}
                      onChange={(e) =>
                        setFieldValue(
                          f.key,
                          f.numeric ? e.target.value.replace(/\D/g, "") : e.target.value,
                        )
                      }
                      placeholder={f.placeholder}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-base outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-sm"
                    />
                  )}
                  {f.help && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-2">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      {f.help}
                    </p>
                  )}
                </div>
              ))}
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
          </div>
        </form>
      </div>

      {/* Bar bawah sticky (mobile): ringkasan + tombol submit form panel.
          Sticky (bukan fixed) agar menempel saat scroll tapi tidak menutupi
          footer ketika sudah sampai akhir halaman. */}
      <div className="sticky bottom-0 z-30 -mx-4 flex items-center justify-between gap-3 rounded-t-2xl border-t border-gray-100 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_16px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
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
  icon,
  selected,
  onSelect,
}: {
  n: TopUpNominal;
  icon?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative min-w-0 rounded-2xl border p-3 text-left transition-all sm:p-4 ${
        selected
          ? "border-brand bg-brand/[0.04] shadow-sm"
          : "border-gray-200 bg-white hover:border-brand/50 hover:shadow-sm"
      }`}
    >
      {selected && (
        <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
      {icon && (
        <span className="mb-2 flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt="" loading="lazy" className="h-8 w-8 object-contain" />
        </span>
      )}
      <p className="clamp-2 pr-5 text-sm font-semibold leading-snug text-ink">{n.name}</p>
      {n.type && (
        <span className="mt-1.5 inline-block max-w-full truncate rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-muted">
          {n.type}
        </span>
      )}
      <p className="mt-2 text-base font-extrabold text-brand">{formatRupiah(n.sellPrice)}</p>
    </button>
  );
}
