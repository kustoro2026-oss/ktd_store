"use client";

import { useEffect, useState } from "react";
import { Banknote, Loader2, Lock, MapPin, Truck, X } from "lucide-react";
import {
  BANK_ACCOUNTS,
  PAYMENT_METHODS,
  buildWhatsAppOrderMessage,
  whatsappLink,
} from "@/lib/config";
import WhatsAppIcon from "@/components/WhatsAppIcon";

type Props = {
  open: boolean;
  onClose: () => void;
  productName: string;
  price: string;
  /** When set (cart checkout), the modal orders all items at once. */
  items?: { id: string; name: string; price: string }[];
  /** Label varian terpilih (mis. "BLACK - S") — otomatis isi catatan. */
  variantLabel?: string;
  /** Berat produk dalam gram (dari anekadropship). Jika ada, berat terkunci. */
  weight?: number | null;
  /** Teks berat asli untuk ditampilkan (mis. "500 Gram"). */
  weightLabel?: string;
  /** Volume produk (mis. "7 x 7 x 23 CM"). */
  volume?: string;
  /** Ekspedisi yang didukung produk (filter daftar kurir ongkir). */
  ekspedisi?: string[];
  /** Alamat penjual tempat barang dikirim. */
  sellerAddress?: string;
};

type Province = { id: number | string; provinsi_name: string };
type City = { id: number | string; kabupaten_name: string };
type District = { id: number | string; kecamatan_name: string };
type Rate = {
  service: string;
  service_name: string;
  service_type: string;
  cost: string;
  etd: string;
  cod: boolean;
};

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted-2 focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelCls = "mb-1 block text-xs font-semibold text-ink";

const formatRupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);

/** "Rp 25.000" -> 25000 */
const parseRupiah = (s: string) => {
  const d = s.replace(/\D/g, "");
  return d ? Number(d) : 0;
};

// Pesan ramah saat API ongkir tidak bisa dihubungi (mis. 502 dari CDN).
const ONGKIR_UNAVAILABLE =
  "Cek ongkir sementara tidak tersedia. Silakan coba beberapa saat lagi.";

// Baca respons API dengan aman. Saat API error dan CDN ikut campur (mis.
// Cloudflare mengganti body dengan halaman "error code: 502"), responsnya
// bukan JSON — tampilkan pesan ramah alih-alih error parsing yang membingungkan.
async function readJson<T>(res: Response, fallbackMsg: string): Promise<T> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  throw new Error(fallbackMsg);
}

// Province list rarely changes — cache it between modal opens.
let provinceCache: Province[] = [];

export default function WhatsAppOrderModal({
  open,
  onClose,
  productName,
  price,
  items,
  variantLabel,
  weight,
  weightLabel,
  volume,
  ekspedisi,
  sellerAddress,
}: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [payment, setPayment] = useState("");

  // Location & shipping
  const [provinces, setProvinces] = useState<Province[]>(provinceCache);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [provinceId, setProvinceId] = useState("");
  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [provincesLoading, setProvincesLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  // Berat terkunci bila produk punya data berat dari anekadropship.
  const lockedWeight = typeof weight === "number" && weight > 0 ? weight : null;
  const [weightStr, setWeightStr] = useState("1000");
  const [rates, setRates] = useState<Rate[]>([]);
  const [selectedRate, setSelectedRate] = useState<number | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");

  // Reset the form every time the modal opens.
  useEffect(() => {
    // Intentional reset of all fields when the modal (re)opens.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (open) {
      setName("");
      setPhone("");
      setAddress("");
      setQty("1");
      setNote(variantLabel ?? "");
      setError("");
      setCities([]);
      setDistricts([]);
      setProvinceId("");
      setCityId("");
      setDistrictId("");
      setLocationError("");
      setPayment("");
      setWeightStr(lockedWeight !== null ? String(lockedWeight) : "1000");
      setRates([]);
      setSelectedRate(null);
      setRatesError("");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, variantLabel]);

  // Load provinces when the modal opens (cached after the first time).
  useEffect(() => {
    if (!open) return;
    if (provinceCache.length) {
      // Sync the module-level cache into state when opening.
      /* eslint-disable react-hooks/set-state-in-effect */
      setProvinces(provinceCache);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    setProvincesLoading(true);
    fetch("/api/shipping/provinces")
      .then((r) =>
        readJson<{ error?: string; provinces?: Province[] }>(r, ONGKIR_UNAVAILABLE)
      )
      .then((j) => {
        if (j.error) throw new Error(j.error);
        provinceCache = j.provinces ?? [];
        setProvinces(provinceCache);
      })
      .catch((e: unknown) =>
        setLocationError(e instanceof Error ? e.message : "Gagal memuat provinsi")
      )
      .finally(() => setProvincesLoading(false));
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onProvinceChange = (v: string) => {
    setProvinceId(v);
    setCityId("");
    setDistrictId("");
    setCities([]);
    setDistricts([]);
    setRates([]);
    setSelectedRate(null);
    setRatesError("");
    if (!v) return;
    setCitiesLoading(true);
    fetch(`/api/shipping/cities?provinsi_id=${encodeURIComponent(v)}`)
      .then((r) =>
        readJson<{ error?: string; cities?: City[] }>(r, ONGKIR_UNAVAILABLE)
      )
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setCities(j.cities ?? []);
      })
      .catch((e: unknown) =>
        setLocationError(e instanceof Error ? e.message : "Gagal memuat kota")
      )
      .finally(() => setCitiesLoading(false));
  };

  const onCityChange = (v: string) => {
    setCityId(v);
    setDistrictId("");
    setDistricts([]);
    setRates([]);
    setSelectedRate(null);
    setRatesError("");
    if (!v) return;
    setDistrictsLoading(true);
    fetch(`/api/shipping/districts?kabupaten_id=${encodeURIComponent(v)}`)
      .then((r) =>
        readJson<{ error?: string; districts?: District[] }>(r, ONGKIR_UNAVAILABLE)
      )
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setDistricts(j.districts ?? []);
      })
      .catch((e: unknown) =>
        setLocationError(e instanceof Error ? e.message : "Gagal memuat kecamatan")
      )
      .finally(() => setDistrictsLoading(false));
  };

  const onDistrictChange = (v: string) => {
    setDistrictId(v);
    setRates([]);
    setSelectedRate(null);
    setRatesError("");
  };

  const unitPrice = parseRupiah(price);
  const qtyNum = Math.max(1, Number(qty.replace(/\D/g, "") || "1"));
  const isCart = Boolean(items && items.length > 0);
  const subtotal = isCart
    ? (items ?? []).reduce((s, it) => s + parseRupiah(it.price), 0)
    : unitPrice * qtyNum;

  const checkRates = () => {
    if (!districtId) {
      setRatesError("Pilih kecamatan tujuan terlebih dahulu.");
      return;
    }
    const w = lockedWeight ?? Number(weightStr);
    if (!w || !Number.isFinite(w) || w < 1) {
      setRatesError("Isi berat paket terlebih dahulu (gram).");
      return;
    }
    setRatesLoading(true);
    setRatesError("");
    fetch("/api/shipping/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: districtId,
        weight: Math.round(w),
        itemValue: subtotal,
      }),
    })
      .then((r) =>
        readJson<{ error?: string; results?: Rate[] }>(r, ONGKIR_UNAVAILABLE)
      )
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setRates(j.results ?? []);
        if (!(j.results ?? []).length) setRatesError("Tidak ada kurir yang melayani tujuan ini.");
      })
      .catch((e: unknown) =>
        setRatesError(e instanceof Error ? e.message : "Gagal menghitung ongkir")
      )
      .finally(() => setRatesLoading(false));
  };

  // Kurir yang tampil: filter ke ekspedisi yang didukung produk (jika ada).
  // Jika tidak ada yang cocok, tampilkan semua supaya ongkir tetap bisa dicek.
  const visibleRates = (() => {
    if (!ekspedisi?.length) return rates;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const allowed = ekspedisi.map(norm);
    const filtered = rates.filter((r) => {
      const hay = norm(`${r.service_name} ${r.service}`);
      return allowed.some((e) => hay.includes(e));
    });
    return filtered.length ? filtered : rates;
  })();

  const selected: Rate | null =
    selectedRate !== null ? (visibleRates[selectedRate] ?? null) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      setError("Nama penerima dan alamat wajib diisi.");
      return;
    }
    if (!districtId) {
      setError("Pilih provinsi, kota, dan kecamatan tujuan.");
      return;
    }
    if (!selected) {
      setError("Klik \"Cek Ongkir\" lalu pilih kurir pengiriman.");
      return;
    }
    if (!payment) {
      setError("Pilih metode pembayaran (COD atau Transfer Bank).");
      return;
    }
    const paymentLabel =
      PAYMENT_METHODS.find((p) => p.key === payment)?.label ?? payment;
    const costNum = Number(selected.cost) || 0;
    const total = subtotal + costNum;
    const productUrl = typeof window !== "undefined" ? window.location.href : "";
    const message = buildWhatsAppOrderMessage({
      productName: isCart ? "Checkout Keranjang" : productName,
      price: isCart ? formatRupiah(subtotal) : price,
      items: isCart ? items : undefined,
      productUrl,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      qty: isCart ? "" : qty.trim(),
      note: note.trim(),
      payment: paymentLabel,
      shipping: {
        courier: selected.service_name + (selected.etd ? ` (estimasi ${selected.etd} hari)` : ""),
        cost: formatRupiah(costNum),
        total: formatRupiah(total),
      },
    });
    window.open(whatsappLink(message), "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-white">
              <WhatsAppIcon className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-ink">Pesan via WhatsApp</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-2 transition-colors hover:bg-gray-100 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Product summary */}
        <div className="mb-4 rounded-xl bg-gray-50 p-3">
          {isCart ? (
            <ul className="space-y-1 text-xs text-muted">
              {(items ?? []).map((it) => (
                <li key={it.id} className="flex justify-between gap-3">
                  <span className="line-clamp-2 min-w-0 flex-1">{it.name}</span>
                  <span className="shrink-0 font-medium text-ink">{it.price}</span>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="line-clamp-2 text-sm font-medium text-ink">{productName}</p>
              <p className="mt-1 text-base font-bold text-brand">{price}</p>
              {sellerAddress && (
                <p className="mt-1 line-clamp-1 text-[11px] text-muted-2">
                  Dikirim dari: {sellerAddress}
                </p>
              )}
            </>
          )}
          <p className="mt-1.5 text-xs text-muted">
            Subtotal ({isCart ? (items ?? []).length : qtyNum} produk): {formatRupiah(subtotal)}
          </p>
          {selected && (
            <p className="mt-1 text-xs text-muted">
              Ongkir ({selected.service_name}): {formatRupiah(Number(selected.cost) || 0)}{" "}
              — <b className="text-brand">Total: {formatRupiah(subtotal + (Number(selected.cost) || 0))}</b>
            </p>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="wa-name" className={labelCls}>
              Nama Penerima <span className="text-red-500">*</span>
            </label>
            <input
              id="wa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap penerima"
              className={inputCls}
              autoComplete="name"
            />
          </div>

          <div>
            <label htmlFor="wa-phone" className={labelCls}>
              No. HP Penerima
            </label>
            <input
              id="wa-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              inputMode="tel"
              className={inputCls}
              autoComplete="tel"
            />
          </div>

          <div>
            <label htmlFor="wa-address" className={labelCls}>
              Alamat Lengkap <span className="text-red-500">*</span>
            </label>
            <textarea
              id="wa-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, kode pos"
              rows={2}
              className={inputCls}
            />
          </div>

          {/* Lokasi pengiriman + ongkir otomatis */}
          <div className="rounded-xl border border-brand/15 bg-brand/5 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink">
              <MapPin className="h-3.5 w-3.5 text-brand" />
              Lokasi Pengiriman &amp; Ongkir <span className="text-red-500">*</span>
            </p>

            <div className="space-y-2">
              <select
                value={provinceId}
                onChange={(e) => onProvinceChange(e.target.value)}
                disabled={provincesLoading}
                className={inputCls}
                aria-label="Provinsi"
              >
                <option value="">
                  {provincesLoading ? "Memuat provinsi…" : "Pilih provinsi"}
                </option>
                {provinces.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {p.provinsi_name}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={cityId}
                  onChange={(e) => onCityChange(e.target.value)}
                  disabled={!provinceId || citiesLoading}
                  className={inputCls}
                  aria-label="Kota/Kabupaten"
                >
                  <option value="">
                    {citiesLoading ? "Memuat…" : "Pilih kota"}
                  </option>
                  {cities.map((c) => (
                    <option key={String(c.id)} value={String(c.id)}>
                      {c.kabupaten_name}
                    </option>
                  ))}
                </select>

                <select
                  value={districtId}
                  onChange={(e) => onDistrictChange(e.target.value)}
                  disabled={!cityId || districtsLoading}
                  className={inputCls}
                  aria-label="Kecamatan"
                >
                  <option value="">
                    {districtsLoading ? "Memuat…" : "Pilih kecamatan"}
                  </option>
                  {districts.map((d) => (
                    <option key={String(d.id)} value={String(d.id)}>
                      {d.kecamatan_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <div className="relative w-28 shrink-0">
                  <input
                    value={lockedWeight !== null ? String(lockedWeight) : weightStr}
                    onChange={(e) => {
                      setWeightStr(e.target.value);
                      setRates([]);
                      setSelectedRate(null);
                    }}
                    disabled={lockedWeight !== null}
                    inputMode="numeric"
                    aria-label="Berat paket (gram)"
                    className={`${inputCls} pr-8 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-muted-2`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-2">
                    gr
                  </span>
                  {lockedWeight !== null && (
                    <span
                      className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-2"
                      title="Berat mengikuti data produk"
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={checkRates}
                  disabled={ratesLoading || !districtId}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ratesLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Truck className="h-4 w-4" />
                  )}
                  Cek Ongkir
                </button>
              </div>
              {lockedWeight !== null && (
                <p className="text-[11px] text-muted-2">
                  Berat {weightLabel ?? `${lockedWeight} gram`}
                  {volume ? ` · Volume ${volume}` : ""} — sesuai data produk, tidak
                  bisa diubah.
                </p>
              )}
            </div>

            {locationError && <p className="mt-2 text-xs font-medium text-red-500">{locationError}</p>}
            {ratesError && <p className="mt-2 text-xs font-medium text-red-500">{ratesError}</p>}

            {visibleRates.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">
                  Pilih kurir
                </p>
                {visibleRates.map((r, i) => (
                  <label
                    key={`${r.service}-${r.service_type}-${i}`}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 transition-colors ${
                      selectedRate === i
                        ? "border-brand ring-2 ring-brand/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping-rate"
                      checked={selectedRate === i}
                      onChange={() => setSelectedRate(i)}
                      className="h-4 w-4 accent-brand"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {r.service_name}
                      </span>
                      <span className="block text-[11px] text-muted-2">
                        {r.etd ? `Estimasi ${r.etd} hari` : "Estimasi menyusul"}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-brand">
                      {formatRupiah(Number(r.cost) || 0)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Metode pembayaran */}
          <div className="rounded-xl border border-brand/15 bg-brand/5 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink">
              <Banknote className="h-3.5 w-3.5 text-brand" />
              Metode Pembayaran <span className="text-red-500">*</span>
            </p>
            <div className="space-y-1.5">
              {PAYMENT_METHODS.map((p) => (
                <label
                  key={p.key}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border bg-white px-3 py-2 transition-colors ${
                    payment === p.key
                      ? "border-brand ring-2 ring-brand/20"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    checked={payment === p.key}
                    onChange={() => setPayment(p.key)}
                    className="mt-0.5 h-4 w-4 accent-brand"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{p.label}</span>
                    <span className="block text-[11px] text-muted-2">{p.note}</span>
                  </span>
                </label>
              ))}
            </div>
            {payment === "transfer" && (
              <div className="mt-2 rounded-lg bg-white p-3">
                {BANK_ACCOUNTS.length > 0 ? (
                  <div className="space-y-2">
                    {BANK_ACCOUNTS.map((acc) => (
                      <div
                        key={`${acc.bank}-${acc.accountNumber}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-ink">
                            {acc.bank} · a.n. {acc.accountName}
                          </p>
                          <p className="truncate font-mono text-sm text-brand">
                            {acc.accountNumber}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(acc.accountNumber).catch(() => {});
                          }}
                          className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-muted-2 transition-colors hover:border-brand hover:text-brand"
                        >
                          Salin
                        </button>
                      </div>
                    ))}
                    <p className="text-[11px] text-muted-2">
                      Setelah transfer, kirim bukti pembayaran ke WhatsApp kami untuk
                      konfirmasi pesanan.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-2">
                    Nomor rekening akan dikirimkan admin via WhatsApp setelah pesanan
                    Anda kami terima.
                  </p>
                )}
              </div>
            )}
          </div>

          {!isCart && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="wa-qty" className={labelCls}>
                  Jumlah
                </label>
                <input
                  id="wa-qty"
                  value={qty}
                  onChange={(e) => {
                    setQty(e.target.value);
                    setRates([]);
                    setSelectedRate(null);
                  }}
                  inputMode="numeric"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="wa-note" className={labelCls}>
                  Catatan (opsional)
                </label>
                <input
                  id="wa-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ukuran, warna, dll."
                  className={inputCls}
                />
              </div>
            </div>
          )}
          {isCart && (
            <div>
              <label htmlFor="wa-note" className={labelCls}>
                Catatan (opsional)
              </label>
              <input
                id="wa-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ukuran, warna, dll."
                className={inputCls}
              />
            </div>
          )}

          {error && <p className="text-xs font-medium text-red-500">{error}</p>}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1eb85a]"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Kirim Pesanan via WhatsApp
          </button>
          <p className="text-center text-[11px] text-muted-2">
            Ongkir dihitung otomatis dari KiriminAja. Anda akan diarahkan ke WhatsApp
            untuk mengirim pesan pesanan.
          </p>
        </form>
      </div>
    </div>
  );
}
