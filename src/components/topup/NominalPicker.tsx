"use client";

// Halaman pilih nominal provider (pola halaman game itemku): header brand,
// tab kategori tersegmen (bila provider lintas kategori), pencarian nominal,
// grid kartu nominal bertahap (load more) yang dikelompokkan per
// sub-kategori (Pulsa Reguler, Paket Harian, ...), dan panel beli sticky kanan
// (bawah di mobile) dengan picker metode pembayaran gaya checkout produk
// (QRIS / VA / e-wallet / kartu / minimarket). Alur pesanan:
// POST /api/topup/order → halaman bayar, atau fallback WhatsApp untuk
// nominal < Rp 10.000.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  QrCode,
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
import {
  duitkuRows,
  type DuitkuChannelRow,
  type DuitkuPaymentMethod,
} from "@/lib/duitku-channels";

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
/** Jumlah kartu nominal yang dirender sekali jalan per sub-kelompok
 *  (grid bisa ribuan baris; tombol load more menambah bertahap). */
const BASE_SHOW = 24;
const SHOW_STEP = 24;
/** Kunci kelompok untuk daftar nominal datar (kategori selain pulsa/data). */
const GROUP_FLAT = "—";

/** Ekstrak durasi (hari) dari nama nominal, mis. "Data 1 GB 3 Hari" → 3. */
function parseDurasiHari(name: string): number | null {
  const m = name.match(/(\d+)\s*Hari/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Label sub-kelompok nominal pada kategori pulsa & data; kategori lain
 *  mengembalikan GROUP_FLAT (daftar datar tanpa header kelompok). */
function groupLabelFor(n: TopUpNominal, cat: TopUpCategory): string {
  const t = (n.type || "").toLowerCase();
  const nama = (n.name || "").toLowerCase();
  // Gabungan type + nama — beberapa SKU menulis info di nama saja
  // (mis. type "Semua Operator" dengan nama "Telepon Semua Operator ...").
  const gabung = `${t} ${nama}`;
  if (cat === "pulsa") {
    if (gabung.includes("sms")) return "Paket SMS";
    if (/(telepon|telpon|nelpon|talkmania|pamasuka|sesama)/.test(gabung)) return "Paket Nelpon";
    if (gabung.includes("transfer")) return "Pulsa Transfer";
    if (gabung.includes("masa aktif")) return "Masa Aktif";
    if (t.includes("data")) return "Paket Data";
    return "Pulsa Reguler";
  }
  if (cat === "data") {
    if (t.includes("cek") || nama.startsWith("cek ")) return "Cek & Info";
    if (t.includes("roaming")) return "Paket Roaming";
    const d = parseDurasiHari(n.name);
    if (d !== null && d <= 1) return "Paket Harian";
    if (d !== null && d <= 7) return "Paket Mingguan";
    if (d !== null) return "Paket Bulanan";
    if (
      nama.startsWith("voucher") ||
      nama.startsWith("aktivasi voucher") ||
      nama.startsWith("aktivasi perdana")
    ) {
      return "Voucher & Aktivasi";
    }
    return "Paket Lainnya";
  }
  return GROUP_FLAT;
}

/** Urutan tampil sub-kelompok per kategori (label lain menyusul di belakang). */
const GROUP_ORDER: Partial<Record<TopUpCategory, string[]>> = {
  pulsa: [
    "Pulsa Reguler",
    "Paket SMS",
    "Paket Nelpon",
    "Pulsa Transfer",
    "Masa Aktif",
    "Paket Data",
  ],
  data: [
    "Paket Harian",
    "Paket Mingguan",
    "Paket Bulanan",
    "Voucher & Aktivasi",
    "Paket Roaming",
    "Paket Lainnya",
    "Cek & Info",
  ],
};

/** Kelompokkan nominal per sub-kategori dengan urutan yang konsisten. */
function groupNominals(
  nominals: TopUpNominal[],
  cat: TopUpCategory,
): [string, TopUpNominal[]][] {
  const map = new Map<string, TopUpNominal[]>();
  for (const n of nominals) {
    const label = groupLabelFor(n, cat);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(n);
  }
  const order = GROUP_ORDER[cat] ?? [];
  return [...map.entries()].sort((a, b) => {
    const ia = order.indexOf(a[0]);
    const ib = order.indexOf(b[0]);
    if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export default function NominalPicker({ provider, initialSku }: Props) {
  const router = useRouter();

  // Kategori provider (urutan sesuai TOPUP_CATEGORIES).
  const catOrder = TOPUP_CATEGORIES.map((c) => c.id);
  const cats: TopUpCategory[] = [...new Set(provider.nominals.map((n) => n.category))].sort(
    (a, b) => catOrder.indexOf(a) - catOrder.indexOf(b),
  );

  const validInitial = provider.nominals.some((n) => n.sku === initialSku) ? initialSku : undefined;
  // Tab awal: ikuti ?sku= bila ada; kalau tidak, dahulukan kategori pulsa
  // (pembeli operator paling sering datang untuk beli pulsa), lalu primaryCategory.
  const [tab, setTab] = useState<TopUpCategory>(
    () =>
      provider.nominals.find((n) => n.sku === validInitial)?.category ??
      (cats.includes("pulsa") ? "pulsa" : provider.primaryCategory),
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
  /** Jumlah kartu yang tampil per sub-kelompok nominal (label → jumlah). */
  const [groupVisible, setGroupVisible] = useState<Record<string, number>>({});

  // Picker metode pembayaran — pola sama dengan checkout produk:
  // kategori → provider → kartu metode terpilih (klik untuk ganti).
  /** Kode kanal Duitku pilihan pembeli (mis. SP = QRIS ShopeePay). Kosong = pakai QRIS pertama yang aktif. */
  const [payProvider, setPayProvider] = useState("");
  /** Kategori yang sedang dibuka daftar provider-nya (akordeon step 2). */
  const [openChannel, setOpenChannel] = useState<string | null>(null);
  /** Daftar metode pembayaran aktif (kode + logo resmi gateway). */
  const [duitkuMethods, setDuitkuMethods] = useState<DuitkuPaymentMethod[]>([]);

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
    // praseleksi dari ?sku= ikut terlihat di grid kelompoknya.
    setNomFilter("");
    const next: Record<string, number> = {};
    for (const [label, items] of groupNominals(provider.nominals, tab)) {
      const idx = validInitial ? items.findIndex((n) => n.sku === validInitial) : -1;
      next[label] = idx >= 0 ? Math.max(BASE_SHOW, idx + 1) : BASE_SHOW;
    }
    setGroupVisible(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.slug, tab]);

  // Muat daftar metode pembayaran aktif (logo QRIS / bank) untuk picker
  // kanal di panel beli — sekali saja; respons ter-cache 10 menit di server.
  // Nominal praseleksi (bila ada) ikut dikirim agar daftar kanal sesuai
  // jumlah tagihan.
  useEffect(() => {
    if (duitkuMethods.length) return;
    const amount =
      nominal && nominal.sellPrice >= WA_MIN ? `?amount=${nominal.sellPrice}` : "";
    fetch(`/api/duitku/methods${amount}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; methods?: DuitkuPaymentMethod[] }) => {
        if (j.ok && Array.isArray(j.methods)) setDuitkuMethods(j.methods);
      })
      .catch(() => {
        // Gateway belum siap — fallback kanal SP/VA ditangani server.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duitkuMethods.length]);

  const selectTab = (c: TopUpCategory) => {
    setTab(c);
    setNomFilter("");
  };

  const nominal = provider.nominals.find((n) => n.sku === sku) ?? null;
  const gridNominals = provider.nominals.filter((n) => n.category === tab);
  const q = nomFilter.trim().toLowerCase();
  const filtered = q
    ? gridNominals.filter(
        (n) => n.name.toLowerCase().includes(q) || n.sku.toLowerCase().includes(q),
      )
    : gridNominals;
  // Nominal dikelompokkan per sub-kategori (Pulsa Reguler, Paket Harian, ...)
  // khusus kategori pulsa & data; kategori lain tetap satu daftar datar.
  const groups = groupNominals(filtered, tab);
  const totalVisible = groups.reduce(
    (sum, [label, items]) =>
      sum + Math.min(items.length, groupVisible[label] ?? BASE_SHOW),
    0,
  );
  const isWaOnly = nominal !== null && nominal.sellPrice < WA_MIN;

  // ─── Picker metode pembayaran (pola sama dengan checkout produk) ───────
  /** Baris kategori dari daftar kanal aktif (urutan tetap). */
  const rows = duitkuRows(duitkuMethods);
  /** Kanal yang dipakai saat pesanan dikirim: pilihan pembeli, atau QRIS
   *  pertama yang aktif bila pembeli belum memilih. */
  const effectiveProvider =
    payProvider ||
    rows.find((r) => r.key === "qris")?.methods[0]?.code ||
    rows[0]?.methods[0]?.code ||
    "SP";
  /** Kategori yang sedang dibuka daftar provider-nya (step 2). */
  const openDuitkuRow = openChannel
    ? rows.find((r) => r.key === openChannel) ?? null
    : null;
  /** Provider terpilih beserta kategori induknya — kartu "metode terpilih". */
  const chosenDuitku: {
    row: DuitkuChannelRow;
    method: DuitkuPaymentMethod;
  } | null = (() => {
    if (!payProvider) return null;
    for (const row of rows) {
      const method = row.methods.find((m) => m.code === payProvider);
      if (method) return { row, method };
    }
    return null;
  })();

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
          paymentChannel: effectiveProvider,
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
              {cats.map((c) => {
                const count = provider.nominals.filter((n) => n.category === c).length;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => selectTab(c)}
                    className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                      tab === c ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"
                    }`}
                  >
                    {TOPUP_CATEGORIES.find((x) => x.id === c)?.label}
                    <span
                      className={`ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        tab === c ? "bg-brand/10 text-brand" : "bg-white text-muted-2"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pencarian nominal */}
          {gridNominals.length > 24 && (
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
              <input
                type="search"
                value={nomFilter}
                onChange={(e) => setNomFilter(e.target.value)}
                placeholder={`Cari nominal ${provider.label}…`}
                autoComplete="off"
                aria-label={`Cari nominal ${provider.label}`}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          )}

          <p className="mt-4 text-xs text-muted-2">
            Menampilkan{" "}
            <b className="font-semibold text-muted">{totalVisible}</b> dari{" "}
            <b className="font-semibold text-muted">{filtered.length}</b> nominal
            {q ? <> untuk &ldquo;{nomFilter.trim()}&rdquo;</> : null}
          </p>

          {filtered.length === 0 ? (
            <p className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-6 text-center text-sm text-muted">
              Tidak ada nominal yang cocok dengan &ldquo;{nomFilter.trim()}&rdquo;.
            </p>
          ) : (
            <div className="mt-3 space-y-8">
              {groups.map(([label, items]) => {
                const shown = Math.min(items.length, groupVisible[label] ?? BASE_SHOW);
                const isFlat = label === GROUP_FLAT;
                return (
                  <section key={label} aria-label={isFlat ? undefined : label}>
                    {!isFlat && (
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                        <span aria-hidden="true" className="h-4 w-1 rounded-full bg-brand" />
                        {label}
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-muted">
                          {items.length}
                        </span>
                      </h3>
                    )}
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                      {items.slice(0, shown).map((n) => (
                        <NominalCard
                          key={n.sku}
                          n={n}
                          icon={schema.icon}
                          selected={sku === n.sku}
                          onSelect={() => setSku(n.sku)}
                        />
                      ))}
                    </div>
                    {items.length > shown && (
                      <div className="mt-4 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setGroupVisible((g) => ({ ...g, [label]: shown + SHOW_STEP }))
                          }
                          className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-brand transition-colors hover:border-brand hover:bg-brand/[0.04]"
                        >
                          Tampilkan Lebih Banyak
                          <span className="ml-1.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-muted">
                            +{Math.min(SHOW_STEP, items.length - shown)}
                          </span>
                        </button>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
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

            {!isWaOnly && (
              <div>
                <p className="mb-1.5 text-sm font-semibold text-ink">
                  Metode Pembayaran
                </p>
                {openDuitkuRow ? (
                  /* Step 2 — tampilan khusus kategori terpilih: tombol kembali
                     + header kategori + daftar provider. */
                  <div className="rounded-xl bg-gray-50 p-3">
                    <button
                      type="button"
                      onClick={() => setOpenChannel(null)}
                      className="mb-2 flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand/10"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Kembali
                      <span className="font-normal text-muted-2">
                        — pilih metode pembayaran lain
                      </span>
                    </button>
                    <div className="mb-2 flex items-center gap-3 rounded-lg bg-white px-3 py-2.5">
                      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                        {openDuitkuRow.methods.slice(0, 5).map((m) =>
                          m.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={m.code}
                              src={m.image}
                              alt={m.name}
                              className="h-6 w-auto rounded object-contain"
                            />
                          ) : (
                            <span
                              key={m.code}
                              className="text-[10px] font-semibold text-muted-2"
                            >
                              {m.name}
                            </span>
                          ),
                        )}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-bold uppercase tracking-wide text-ink">
                          {openDuitkuRow.label}
                        </span>
                        <span className="block text-[10px] leading-snug text-muted-2">
                          {openDuitkuRow.note}
                        </span>
                      </span>
                    </div>
                    <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-2">
                      {openDuitkuRow.key === "qris"
                        ? "Pilih aplikasi QRIS"
                        : openDuitkuRow.key === "va"
                          ? "Pilih bank tujuan transfer"
                          : "Pilih metode"}
                    </p>
                    <div className="space-y-1">
                      {openDuitkuRow.methods.map((m) => {
                        const selected = payProvider === m.code;
                        return (
                          <button
                            key={m.code}
                            type="button"
                            onClick={() => {
                              setPayProvider(m.code);
                              setOpenChannel(null);
                            }}
                            className={`flex w-full items-center gap-2.5 rounded-lg bg-white px-2.5 py-2.5 text-left transition-all ${
                              selected ? "ring-2 ring-brand/30" : "hover:bg-brand/5"
                            }`}
                          >
                            {m.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.image}
                                alt={m.name}
                                className="h-6 w-auto rounded object-contain"
                              />
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-[9px] font-bold text-muted-2">
                                {m.code}
                              </span>
                            )}
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                              {m.name}
                            </span>
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                                selected
                                  ? "border-brand bg-brand"
                                  : "border-gray-300 bg-white"
                              }`}
                            >
                              {selected && (
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : chosenDuitku ? (
                  /* Metode terpilih — kartu tunggal; klik untuk mengganti. */
                  <button
                    type="button"
                    onClick={() => setPayProvider("")}
                    className="flex w-full items-center gap-3 rounded-xl bg-brand/5 px-3 py-3 text-left ring-2 ring-brand/30 transition-colors hover:bg-brand/10"
                  >
                    {chosenDuitku.method.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={chosenDuitku.method.image}
                        alt={chosenDuitku.method.name}
                        className="h-6 w-auto rounded object-contain"
                      />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-[9px] font-bold text-muted-2">
                        {chosenDuitku.method.code}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold uppercase tracking-wide text-ink">
                        {chosenDuitku.method.name}
                      </span>
                      <span className="block text-[10px] leading-snug text-muted-2">
                        {chosenDuitku.row.label} — {chosenDuitku.row.note}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-brand">
                      Ganti
                    </span>
                  </button>
                ) : rows.length > 0 ? (
                  /* Step 1 — baris kategori gaya marketplace. */
                  <div className="space-y-1.5">
                    {rows.map((row) => (
                      <button
                        key={row.key}
                        type="button"
                        onClick={() => setOpenChannel(row.key)}
                        className="flex w-full items-center gap-3 rounded-xl bg-gray-50 px-3 py-3 text-left transition-colors hover:bg-gray-100"
                      >
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                          {row.methods.slice(0, 5).map((m) =>
                            m.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={m.code}
                                src={m.image}
                                alt={m.name}
                                className="h-6 w-auto rounded object-contain"
                              />
                            ) : (
                              <span
                                key={m.code}
                                className="text-[10px] font-semibold text-muted-2"
                              >
                                {m.name}
                              </span>
                            ),
                          )}
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-xs font-bold uppercase tracking-wide text-ink">
                            {row.label}
                          </span>
                          <span className="block text-[10px] leading-snug text-muted-2">
                            {row.note}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-2" />
                      </button>
                    ))}
                  </div>
                ) : (
                  /* Daftar kanal belum termuat — tampilkan default QRIS. */
                  <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3">
                    <QrCode className="h-6 w-6 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold uppercase tracking-wide text-ink">
                        QRIS
                      </span>
                      <span className="block text-[10px] leading-snug text-muted-2">
                        Scan dari semua e-wallet & m-banking
                      </span>
                    </span>
                  </div>
                )}
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
              {isWaOnly
                ? "Nominal ini diproses via WhatsApp — CS kami akan memverifikasi pembayaran Anda."
                : "Pilih metode pembayaran di atas — pengisian otomatis setelah pembayaran terverifikasi, biasanya dalam beberapa menit."}
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
