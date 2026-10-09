"use client";

// Beranda top-up bergaya itemku: hero + trust bar, search bar besar dengan
// autocomplete, shortcut kategori berikon, lalu section grid provider per
// kategori. Data seluruhnya dari katalog lokal (src/lib/topup.ts) — tidak
// ada fetch jaringan, sehingga autocomplete instan.
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Gamepad2,
  Headphones,
  Search,
  ShieldCheck,
  Smartphone,
  Tv,
  Wallet,
  Wifi,
  Zap,
} from "lucide-react";
import {
  TOPUP_CATEGORIES,
  TOPUP_PROVIDERS,
  categoryMinPrice,
  categoryNominals,
  categoryProviders,
  formatRupiah,
  type TopUpCategory,
  type TopUpProvider,
} from "@/lib/topup";
import ProviderLogo from "./ProviderLogo";

const RECENT_KEY = "ktd-topup-recent";
const MAX_RECENT = 5;
const MAX_SUGGESTIONS = 8;

const POPULAR = ["Free Fire", "Mobile Legends", "Telkomsel", "PLN", "DANA"];

/** Total SKU di katalog — dipakai strip statistik di hero. */
const TOTAL_NOMINALS = TOPUP_PROVIDERS.reduce((a, p) => a + p.nominals.length, 0);

const TRUST = [
  { icon: ShieldCheck, title: "Transaksi Aman", sub: "Pembayaran terverifikasi otomatis" },
  { icon: Zap, title: "Proses Otomatis", sub: "Saldo masuk dalam hitungan menit" },
  { icon: Headphones, title: "Bantuan CS", sub: "Siap membantu via WhatsApp" },
];

const STEPS = [
  {
    icon: Gamepad2,
    title: "Pilih Game & Nominal",
    desc: "Pilih provider dan nominal, lalu masukkan ID game / nomor tujuan.",
  },
  {
    icon: Wallet,
    title: "Bayar QRIS / Virtual Account",
    desc: "Selesaikan pembayaran via QRIS atau VA — verifikasi otomatis.",
  },
  {
    icon: Zap,
    title: "Saldo Masuk Otomatis",
    desc: "Pengisian diproses otomatis beberapa menit setelah pembayaran lunas.",
  },
];

type Suggestion = {
  slug: string;
  sku?: string;
  title: string;
  sub: string;
};

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        return parsed.slice(0, MAX_RECENT);
      }
    }
  } catch {
    // SSR / private mode / storage rusak
  }
  return [];
}

/** Ikon kategori — cabang JSX eksplisit agar tetap komponen statis. */
function categoryIcon(id: TopUpCategory) {
  switch (id) {
    case "game":
      return <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6" />;
    case "pulsa":
      return <Smartphone className="h-5 w-5 sm:h-6 sm:w-6" />;
    case "data":
      return <Wifi className="h-5 w-5 sm:h-6 sm:w-6" />;
    case "pln":
      return <Zap className="h-5 w-5 sm:h-6 sm:w-6" />;
    case "emoney":
      return <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />;
    case "tv":
      return <Tv className="h-5 w-5 sm:h-6 sm:w-6" />;
  }
}

/** Provider yang cocok dengan kata kunci — label/brand lebih dulu, lalu
 *  nominal per provider. Hasil dibatasi MAX_SUGGESTIONS. */
function buildSuggestions(q: string): Suggestion[] {
  const lq = q.toLowerCase();
  const out: Suggestion[] = [];
  const pushedProvider = new Set<string>();
  for (const p of TOPUP_PROVIDERS) {
    if (p.label.toLowerCase().includes(lq) || p.brand.toLowerCase().includes(lq)) {
      out.push({
        slug: p.slug,
        title: p.label,
        sub: `${p.nominals.length} nominal • mulai ${formatRupiah(Math.min(...p.nominals.map((n) => n.sellPrice)))}`,
      });
      pushedProvider.add(p.slug);
    }
  }
  for (const p of TOPUP_PROVIDERS) {
    for (const n of p.nominals) {
      if (out.length >= MAX_SUGGESTIONS) break;
      if (n.name.toLowerCase().includes(lq) || n.sku.toLowerCase().includes(lq)) {
        if (!pushedProvider.has(p.slug)) {
          out.push({ slug: p.slug, title: p.label, sub: `${p.nominals.length} nominal` });
          pushedProvider.add(p.slug);
        }
        if (out.length < MAX_SUGGESTIONS) {
          out.push({ slug: p.slug, sku: n.sku, title: `${p.label} — ${n.name}`, sub: formatRupiah(n.sellPrice) });
        }
      }
    }
  }
  return out.slice(0, MAX_SUGGESTIONS);
}

function ProviderCard({ p, cat }: { p: TopUpProvider; cat: TopUpCategory }) {
  const count = categoryNominals(p, cat).length;
  return (
    <Link
      href={`/topup/${p.slug}`}
      className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg sm:p-4"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 ring-1 ring-gray-100 transition-colors group-hover:bg-brand/[0.04] sm:h-16 sm:w-16">
        <ProviderLogo slug={p.slug} label={p.label} className="h-9 w-9 sm:h-11 sm:w-11" />
      </span>
      <span className="w-full min-w-0">
        <span className="block truncate text-xs font-semibold leading-tight text-ink sm:text-sm">
          {p.label}
        </span>
        <span className="mt-1 block text-[11px] font-bold text-brand sm:text-xs">
          Mulai {formatRupiah(categoryMinPrice(p, cat))}
        </span>
        <span className="mt-0.5 block text-[10px] text-muted-2">
          {count} nominal
        </span>
      </span>
    </Link>
  );
}

export default function TopUpHome() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    // Isi pencarian terbaru setelah mount (localStorage hanya ada di klien).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(loadRecent());
  }, []);

  const q = query.trim();
  const suggestions = q ? buildSuggestions(q) : [];
  const rowCount = suggestions.length;

  const saveSearch = (term: string) => {
    const next = [term, ...recent.filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(
      0,
      MAX_RECENT,
    );
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // private mode / quota
    }
  };

  const goSuggestion = (s: Suggestion) => {
    saveSearch(s.title);
    setQuery("");
    setOpen(false);
    setActive(-1);
    router.push(`/topup/${s.slug}${s.sku ? `?sku=${s.sku}` : ""}`);
  };

  const goSearch = (term: string) => {
    const s = buildSuggestions(term)[0];
    if (!s) return;
    goSuggestion(s);
  };

  const goChip = (label: string) => {
    const p = TOPUP_PROVIDERS.find((x) => x.label.toLowerCase() === label.toLowerCase());
    if (p) {
      saveSearch(p.label);
      router.push(`/topup/${p.slug}`);
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q) return;
    goSearch(q);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!q || rowCount === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % rowCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? rowCount - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      goSuggestion(suggestions[active]);
    }
  };

  return (
    <div className="pb-8">
      {/* Hero + trust bar */}
      <section className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-b from-brand/[0.07] via-brand/[0.03] to-transparent py-10 sm:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 top-8 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl"
        />
        <div className="container-site relative text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-white/80 px-3 py-1 text-[11px] font-bold text-brand sm:text-xs">
            <Zap className="h-3.5 w-3.5" />
            Proses Otomatis — Saldo Masuk dalam Hitungan Menit
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Top Up &amp; Isi Saldo
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Diamond game, pulsa, paket data, token listrik, dan e-wallet — proses
            otomatis langsung setelah pembayaran terverifikasi.
          </p>

          {/* Search bar besar */}
          <form onSubmit={submitSearch} className="relative mx-auto mt-6 max-w-2xl text-left">
            <div className="flex items-center overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md transition-all focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 focus-within:shadow-lg">
              <Search className="ml-4 h-5 w-5 shrink-0 text-muted-2" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  setActive(-1);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={onKeyDown}
                placeholder="Cari game, pulsa, atau e-wallet…"
                autoComplete="off"
                enterKeyHint="search"
                role="combobox"
                aria-label="Cari produk top up"
                aria-autocomplete="list"
                aria-controls="topup-search-results"
                aria-expanded={open}
                className="min-w-0 w-full px-3 py-3.5 text-base text-ink outline-none placeholder:text-muted-2 sm:text-sm"
              />
              <button
                type="submit"
                className="m-1.5 flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-2"
              >
                <Search className="h-4 w-4 sm:hidden" />
                <span>Cari</span>
              </button>
            </div>

            {open && (
              <div
                id="topup-search-results"
                className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-2xl bg-white text-ink shadow-xl ring-1 ring-black/5"
              >
                {q === "" ? (
                  recent.length ? (
                    <div className="pb-1.5">
                      <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-2">
                        Pencarian terbaru
                      </p>
                      {recent.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onMouseDown={() => goSearch(s)}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-muted transition-colors hover:bg-gray-50 hover:text-brand"
                        >
                          <Clock className="h-4 w-4 text-muted-2" />
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-sm text-muted">
                      Ketik nama game, operator, atau e-wallet — mis. &ldquo;Free
                      Fire&rdquo;, &ldquo;Telkomsel&rdquo;, &ldquo;DANA&rdquo;.
                    </p>
                  )
                ) : suggestions.length > 0 ? (
                  <ul>
                    {suggestions.map((s, i) => (
                      <li key={`${s.slug}-${s.sku ?? "p"}-${i}`}>
                        <button
                          type="button"
                          onMouseDown={() => goSuggestion(s)}
                          onMouseEnter={() => setActive(i)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === active ? "bg-brand/5" : ""}`}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                            <ProviderLogo slug={s.slug} label={s.title} className="h-6 w-6" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {s.title}
                            </span>
                            <span className="block truncate text-xs text-muted-2">{s.sub}</span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-2" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-3 text-sm text-muted">
                    Tidak ada provider atau nominal untuk &ldquo;{q}&rdquo;.
                  </p>
                )}
              </div>
            )}
          </form>

          {/* Chip pencarian populer */}
          <div className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-2">Populer:</span>
            {POPULAR.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => goChip(label)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Trust bar — kartu */}
          <div className="mx-auto mt-8 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
            {TRUST.map((t) => (
              <div
                key={t.title}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white/90 p-3.5 shadow-sm backdrop-blur"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <t.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">{t.title}</span>
                  <span className="block text-xs text-muted">{t.sub}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Strip statistik katalog */}
          <div className="mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-center gap-x-6 gap-y-1.5 text-xs font-semibold text-muted sm:text-sm">
            <span>
              <b className="font-extrabold text-ink">{TOPUP_PROVIDERS.length}</b> Provider
            </span>
            <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-gray-300 sm:inline-block" />
            <span>
              <b className="font-extrabold text-ink">{TOTAL_NOMINALS.toLocaleString("id-ID")}</b>{" "}
              Pilihan Nominal
            </span>
            <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-gray-300 sm:inline-block" />
            <span>
              Bayar <b className="font-extrabold text-ink">QRIS</b> /{" "}
              <b className="font-extrabold text-ink">VA</b>
            </span>
          </div>
        </div>
      </section>

      <div className="container-site">
        {/* Shortcut kategori */}
        <section className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          {TOPUP_CATEGORIES.map((c) => (
            <Link
              key={c.id}
              href={`#kategori-${c.id}`}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md sm:flex-col sm:gap-2 sm:p-4 sm:text-center"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand sm:h-12 sm:w-12">
                {categoryIcon(c.id)}
              </span>
              <span className="text-sm font-semibold text-ink">{c.label}</span>
            </Link>
          ))}
        </section>

        {/* Section per kategori */}
        {TOPUP_CATEGORIES.map((cat) => {
          const providers = categoryProviders(cat.id);
          if (!providers.length) return null;
          return (
            <section key={cat.id} id={`kategori-${cat.id}`} className="mt-10 scroll-mt-24">
              <div className="flex items-end justify-between gap-3 border-b-2 border-brand/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand sm:h-10 sm:w-10">
                    {categoryIcon(cat.id)}
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-ink sm:text-xl">{cat.label}</h2>
                    <p className="mt-0.5 text-xs text-muted sm:text-sm">{cat.desc}</p>
                  </div>
                </div>
                <span className="hidden shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-muted-2 sm:inline-block">
                  {providers.length} provider
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
                {providers.map((p) => (
                  <ProviderCard key={p.slug} p={p} cat={cat.id} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Cara top up + cek status */}
        <section className="mt-12 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-ink">Cara Top Up</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch">
            {STEPS.map((s, i) => (
              <Fragment key={s.title}>
                {i > 0 && (
                  <div aria-hidden="true" className="hidden items-center justify-center sm:flex">
                    <ChevronRight className="h-5 w-5 text-gray-300" />
                  </div>
                )}
                <div className="flex gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <s.icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      <span className="mr-1.5 text-brand">{i + 1}.</span>
                      {s.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{s.desc}</p>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
          <p className="mt-5 border-t border-gray-100 pt-4 text-center text-xs leading-relaxed text-muted">
            Nominal di bawah Rp 10.000 diproses via WhatsApp (konfirmasi CS). Sudah
            bayar?{" "}
            <Link href="/topup/cek-status" className="font-semibold text-brand transition-colors hover:underline">
              Cek Status Pesanan
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
