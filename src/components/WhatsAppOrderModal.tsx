"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  ChevronRight,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Package,
  ShoppingBag,
  Truck,
  User,
  X,
} from "lucide-react";
import {
  BANK_ACCOUNTS,
  COD_FEE,
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
  productId?: string;
  /** Gambar produk (thumbnail) untuk ditampilkan di ringkasan. */
  productImage?: string;
  items?: { id: string; name: string; price: string }[];
  variantLabel?: string;
  weight?: number | null;
  weightLabel?: string;
  volume?: string;
  ekspedisi?: string[];
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
type RateGroup = {
  origin: number;
  label: string;
  weight: number;
  estimated?: boolean;
  results: Rate[];
};

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted-2 focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelCls = "mb-1 block text-xs font-semibold text-ink";

const formatRupiah = (n: number) =>
  "Rp " + new Intl.NumberFormat("id-ID").format(n);

const parseRupiah = (s: string) => {
  const d = s.replace(/\D/g, "");
  return d ? Number(d) : 0;
};

const ONGKIR_UNAVAILABLE =
  "Cek ongkir sementara tidak tersedia. Silakan coba beberapa saat lagi.";

async function readJson<T>(res: Response, fallbackMsg: string): Promise<T> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  throw new Error(fallbackMsg);
}

let provinceCache: Province[] = [];

export default function WhatsAppOrderModal({
  open,
  onClose,
  productName,
  price,
  productId,
  productImage,
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

  const lockedWeight = typeof weight === "number" && weight > 0 ? weight : null;
  const [weightStr, setWeightStr] = useState("1000");
  const [groups, setGroups] = useState<RateGroup[]>([]);
  const [selectedByGroup, setSelectedByGroup] = useState<
    Record<number, number>
  >({});
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");

  useEffect(() => {
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
      setGroups([]);
      setSelectedByGroup({});
      setRatesError("");
    }
  }, [open, variantLabel]);

  useEffect(() => {
    if (!open) return;
    if (provinceCache.length) {
      setProvinces(provinceCache);
      return;
    }
    setProvincesLoading(true);
    fetch("/api/shipping/provinces")
      .then((r) =>
        readJson<{ error?: string; provinces?: Province[] }>(
          r,
          ONGKIR_UNAVAILABLE
        )
      )
      .then((j) => {
        if (j.error) throw new Error(j.error);
        provinceCache = j.provinces ?? [];
        setProvinces(provinceCache);
      })
      .catch((e: unknown) =>
        setLocationError(
          e instanceof Error ? e.message : "Gagal memuat provinsi"
        )
      )
      .finally(() => setProvincesLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto cek ongkir begitu kecamatan dipilih
  useEffect(() => {
    if (!open || !districtId) return;
    const w = lockedWeight ?? Number(weightStr);
    if (!isCart && (!w || !Number.isFinite(w) || w < 1)) return;
    setRatesLoading(true);
    setRatesError("");
    const payload: Record<string, unknown> = {
      destination: districtId,
      itemValue: subtotal,
    };
    if (isCart) {
      payload.productIds = (items ?? []).map((it) => it.id);
    } else {
      if (productId) payload.productId = productId;
      payload.weight = Math.round(w);
    }
    fetch("/api/shipping/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) =>
        readJson<{ error?: string; groups?: RateGroup[] }>(
          r,
          ONGKIR_UNAVAILABLE
        )
      )
      .then((j) => {
        if (j.error) throw new Error(j.error);
        const gs = j.groups ?? [];
        setGroups(gs);
        setSelectedByGroup({});
        if (!gs.length || gs.every((g) => !(g.results ?? []).length)) {
          setRatesError("Tidak ada kurir yang melayani tujuan ini.");
        }
      })
      .catch((e: unknown) =>
        setRatesError(
          e instanceof Error ? e.message : "Gagal menghitung ongkir"
        )
      )
      .finally(() => setRatesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, districtId, qty, weightStr]);

  if (!open) return null;

  const onProvinceChange = (v: string) => {
    setProvinceId(v);
    setCityId("");
    setDistrictId("");
    setCities([]);
    setDistricts([]);
    setGroups([]);
    setSelectedByGroup({});
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
        setLocationError(
          e instanceof Error ? e.message : "Gagal memuat kota"
        )
      )
      .finally(() => setCitiesLoading(false));
  };

  const onCityChange = (v: string) => {
    setCityId(v);
    setDistrictId("");
    setDistricts([]);
    setGroups([]);
    setSelectedByGroup({});
    setRatesError("");
    if (!v) return;
    setDistrictsLoading(true);
    fetch(`/api/shipping/districts?kabupaten_id=${encodeURIComponent(v)}`)
      .then((r) =>
        readJson<{ error?: string; districts?: District[] }>(
          r,
          ONGKIR_UNAVAILABLE
        )
      )
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setDistricts(j.districts ?? []);
      })
      .catch((e: unknown) =>
        setLocationError(
          e instanceof Error ? e.message : "Gagal memuat kecamatan"
        )
      )
      .finally(() => setDistrictsLoading(false));
  };

  const onDistrictChange = (v: string) => {
    setDistrictId(v);
    setGroups([]);
    setSelectedByGroup({});
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
    if (!isCart && (!w || !Number.isFinite(w) || w < 1)) {
      setRatesError("Isi berat paket terlebih dahulu (gram).");
      return;
    }
    setRatesLoading(true);
    setRatesError("");
    const payload: Record<string, unknown> = {
      destination: districtId,
      itemValue: subtotal,
    };
    if (isCart) {
      payload.productIds = (items ?? []).map((it) => it.id);
    } else {
      if (productId) payload.productId = productId;
      payload.weight = Math.round(w);
    }
    fetch("/api/shipping/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) =>
        readJson<{ error?: string; groups?: RateGroup[] }>(
          r,
          ONGKIR_UNAVAILABLE
        )
      )
      .then((j) => {
        if (j.error) throw new Error(j.error);
        const gs = j.groups ?? [];
        setGroups(gs);
        setSelectedByGroup({});
        if (!gs.length || gs.every((g) => !(g.results ?? []).length)) {
          setRatesError("Tidak ada kurir yang melayani tujuan ini.");
        }
      })
      .catch((e: unknown) =>
        setRatesError(
          e instanceof Error ? e.message : "Gagal menghitung ongkir"
        )
      )
      .finally(() => setRatesLoading(false));
  };

  const ratesFor = (g: RateGroup): Rate[] => {
    if (isCart || !ekspedisi?.length) return g.results ?? [];
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const allowed = ekspedisi.map(norm);
    const filtered = (g.results ?? []).filter((r) => {
      const hay = norm(`${r.service_name} ${r.service}`);
      return allowed.some((e) => hay.includes(e));
    });
    return filtered.length ? filtered : g.results ?? [];
  };

  const selectedFor = (idx: number): Rate | null => {
    const list = groups[idx] ? ratesFor(groups[idx]) : [];
    const sel = selectedByGroup[idx];
    return typeof sel === "number" ? (list[sel] ?? null) : null;
  };

  const totalOngkir = groups.reduce((s, g, idx) => {
    const sel = selectedFor(idx);
    return s + (sel ? Number(sel.cost) || 0 : 0);
  }, 0);

  const allSelected =
    groups.length > 0 && groups.every((_, idx) => selectedFor(idx) !== null);

  const codFeeAmount = payment === "cod" ? COD_FEE : 0;
  const grandTotal = subtotal + totalOngkir + codFeeAmount;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      setError("Nama penerima dan alamat lengkap wajib diisi.");
      return;
    }
    if (!districtId) {
      setError("Pilih provinsi, kota, dan kecamatan tujuan.");
      return;
    }
    if (!allSelected) {
      setError('Klik "Cek Ongkir" lalu pilih kurir pengiriman.');
      return;
    }
    if (!payment) {
      setError("Pilih metode pembayaran (COD atau Transfer Bank).");
      return;
    }
    const paymentLabel =
      PAYMENT_METHODS.find((p) => p.key === payment)?.label ?? payment;
    const productUrl =
      typeof window !== "undefined" ? window.location.href : "";
    const selectedRates = groups.map((g, idx) => ({ g, r: selectedFor(idx)! }));
    const first = selectedRates[0];
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
      codFee: codFeeAmount || undefined,
      shipping: {
        courier:
          first.r.service_name +
          (first.r.etd ? ` (estimasi ${first.r.etd} hari)` : ""),
        cost: formatRupiah(totalOngkir),
        total: formatRupiah(grandTotal),
        groups:
          selectedRates.length > 1
            ? selectedRates.map(({ g, r }) => ({
              label: g.label,
              courier:
                r.service_name +
                (r.etd ? ` (estimasi ${r.etd} hari)` : ""),
              cost: formatRupiah(Number(r.cost) || 0),
            }))
            : undefined,
      },
    });
    window.open(whatsappLink(message), "_blank", "noopener,noreferrer");
    onClose();
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white">
              <WhatsAppIcon className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Checkout Pesanan</h2>
              <p className="text-[11px] text-muted-2">
                Pesanan akan dikirim via WhatsApp
              </p>
            </div>
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

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* ── SECTION 1: Alamat Pengiriman ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10">
                <MapPin className="h-3.5 w-3.5 text-brand" />
              </span>
              <h3 className="text-sm font-bold text-ink">
                Alamat Pengiriman
              </h3>
            </div>

            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="wa-name" className={labelCls}>
                    Nama Penerima <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
                    <input
                      id="wa-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nama lengkap"
                      className={`${inputCls} pl-9`}
                      autoComplete="name"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="wa-phone" className={labelCls}>
                    No. HP
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

              <div>
                <label className={labelCls}>
                  Provinsi / Kota / Kecamatan{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <select
                    value={provinceId}
                    onChange={(e) => onProvinceChange(e.target.value)}
                    disabled={provincesLoading}
                    className={inputCls}
                    aria-label="Provinsi"
                  >
                    <option value="">
                      {provincesLoading
                        ? "Memuat provinsi…"
                        : "Pilih provinsi"}
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
                </div>
                {locationError && (
                  <p className="mt-1.5 text-xs font-medium text-red-500">
                    {locationError}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── SECTION 2: Produk Dipesan ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10">
                <ShoppingBag className="h-3.5 w-3.5 text-brand" />
              </span>
              <h3 className="text-sm font-bold text-ink">Produk Dipesan</h3>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4">
              {isCart ? (
                <ul className="divide-y divide-gray-50">
                  {(items ?? []).map((it) => (
                    <li
                      key={it.id}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <span className="line-clamp-2 min-w-0 flex-1 text-sm text-ink">
                        {it.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-ink">
                        {it.price}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div>
                  <div className="flex items-start gap-3">
                    {productImage ? (
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={productImage}
                          alt={productName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand/5">
                        <Package className="h-5 w-5 text-brand" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-ink">
                        {productName}
                      </p>
                      {sellerAddress && (
                        <p className="mt-0.5 text-[11px] text-muted-2">
                          Dikirim dari: {sellerAddress}
                        </p>
                      )}
                      {variantLabel && (
                        <p className="mt-0.5 text-xs text-muted-2">
                          Varian: {variantLabel}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
                    <span className="text-xl font-extrabold text-brand">
                      {price}
                    </span>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="wa-qty"
                        className="text-xs text-muted-2"
                      >
                        Qty:
                      </label>
                      <input
                        id="wa-qty"
                        value={qty}
                        onChange={(e) => {
                          setQty(e.target.value);
                          setGroups([]);
                          setSelectedByGroup({});
                        }}
                        inputMode="numeric"
                        className="w-16 rounded-lg border border-gray-200 px-2.5 py-1.5 text-center text-sm font-semibold text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── SECTION 3: Opsi Pengiriman ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10">
                <Truck className="h-3.5 w-3.5 text-brand" />
              </span>
              <h3 className="text-sm font-bold text-ink">Opsi Pengiriman</h3>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              {/* Info berat + status loading ongkir */}
              {!isCart && (
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm">
                    {lockedWeight !== null ? (
                      <Lock className="h-3.5 w-3.5 text-muted-2" />
                    ) : null}
                    <span className="font-semibold text-ink">
                      {lockedWeight !== null
                        ? `${lockedWeight} gr`
                        : `${weightStr || "1000"} gr`}
                    </span>
                    {!lockedWeight && (
                      <input
                        value={weightStr}
                        onChange={(e) => setWeightStr(e.target.value)}
                        inputMode="numeric"
                        aria-label="Berat paket (gram)"
                        className="ml-1 w-16 rounded border border-gray-200 px-1.5 py-0.5 text-xs outline-none focus:border-brand"
                      />
                    )}
                  </div>
                  {volume && (
                    <span className="text-xs text-muted-2">
                      Volume {volume}
                    </span>
                  )}
                  {ratesLoading && (
                    <span className="inline-flex items-center gap-1 text-xs text-brand">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Memuat ongkir…
                    </span>
                  )}
                </div>
              )}
              {isCart && ratesLoading && (
                <div className="mb-3 flex items-center gap-2 text-xs text-brand">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Memuat ongkir…
                </div>
              )}

              {!isCart && lockedWeight !== null && (
                <p className="mb-2 text-[11px] text-muted-2">
                  {weightLabel ?? `${lockedWeight} gram`}
                  {volume ? ` · Volume ${volume}` : ""} — sesuai data produk
                </p>
              )}
              {isCart && groups.length > 0 && (
                <p className="mb-2 text-[11px] text-muted-2">
                  Berat dihitung dari data produk ({groups.length}{" "}
                  {groups.length > 1
                    ? "paket terpisah sesuai seller"
                    : "paket"}
                  ).
                </p>
              )}

              {!districtId && (
                <p className="text-[11px] text-muted-2">
                  Pilih kecamatan tujuan untuk melihat ongkir
                </p>
              )}

              {ratesError && (
                <p className="mb-2 text-xs font-medium text-red-500">
                  {ratesError}
                </p>
              )}

              {groups.map((g, gi) => {
                const list = ratesFor(g);
                if (!list.length) return null;
                return (
                  <div key={g.origin} className="mt-3 space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">
                      {groups.length > 1
                        ? `Paket ${gi + 1} — pilih kurir`
                        : "Pilih Kurir"}
                    </p>
                    {groups.length > 1 && (
                      <p className="line-clamp-2 text-[11px] text-muted-2">
                        {g.label} · Berat {g.weight} gram
                        {g.estimated ? " (estimasi)" : ""}
                      </p>
                    )}
                    <div className="space-y-1.5">
                      {list.map((r, i) => (
                        <label
                          key={`${r.service}-${r.service_type}-${i}`}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border bg-white px-3 py-2.5 transition-all ${selectedByGroup[gi] === i
                            ? "border-brand ring-2 ring-brand/20 shadow-sm"
                            : "border-gray-200 hover:border-gray-300"
                            }`}
                        >
                          <input
                            type="radio"
                            name={`shipping-rate-${gi}`}
                            checked={selectedByGroup[gi] === i}
                            onChange={() =>
                              setSelectedByGroup((prev) => ({
                                ...prev,
                                [gi]: i,
                              }))
                            }
                            className="h-4 w-4 accent-brand"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {r.service_name}
                            </span>
                            <span className="block text-[11px] text-muted-2">
                              {r.service} ·{" "}
                              {r.etd
                                ? `Estimasi ${r.etd} hari`
                                : "Estimasi menyusul"}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-bold text-brand">
                            {formatRupiah(Number(r.cost) || 0)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── SECTION 4: Metode Pembayaran ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10">
                <Banknote className="h-3.5 w-3.5 text-brand" />
              </span>
              <h3 className="text-sm font-bold text-ink">
                Metode Pembayaran
              </h3>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <div className="space-y-2">
                {PAYMENT_METHODS.map((p) => (
                  <label
                    key={p.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white px-4 py-3 transition-all ${payment === p.key
                      ? "border-brand ring-2 ring-brand/20 shadow-sm"
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
                      <span className="block text-sm font-semibold text-ink">
                        {p.label}
                      </span>
                      <span className="block text-[11px] text-muted-2">
                        {p.note}
                      </span>
                    </span>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-2" />
                  </label>
                ))}
              </div>

              {payment === "transfer" && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-ink">
                    Rekening Tujuan:
                  </p>
                  {BANK_ACCOUNTS.length > 0 ? (
                    <>
                      {BANK_ACCOUNTS.map((acc) => (
                        <div
                          key={`${acc.bank}-${acc.accountNumber}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink">
                              {acc.bank} · a.n. {acc.accountName}
                            </p>
                            <p className="truncate font-mono text-sm font-bold text-brand">
                              {acc.accountNumber}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard
                                ?.writeText(acc.accountNumber)
                                .catch(() => { });
                            }}
                            className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-muted-2 transition-colors hover:border-brand hover:text-brand"
                          >
                            Salin
                          </button>
                        </div>
                      ))}
                      <p className="text-[11px] text-muted-2">
                        Setelah transfer, kirim bukti pembayaran ke WhatsApp
                        kami untuk konfirmasi pesanan.
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-2">
                      Nomor rekening akan dikirimkan admin via WhatsApp setelah
                      pesanan Anda kami terima.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── SECTION 5: Pesan untuk Penjual ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10">
                <MessageCircle className="h-3.5 w-3.5 text-brand" />
              </span>
              <h3 className="text-sm font-bold text-ink">
                Pesan untuk Penjual
              </h3>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <textarea
                id="wa-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Warna, ukuran, atau catatan tambahan untuk penjual..."
                rows={2}
                className={inputCls}
              />
            </div>
          </section>

          {/* ── Error ── */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <p className="text-xs font-medium text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* ── Sticky Footer: Rincian Pembayaran + Tombol ── */}
        <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-4">
          {/* Rincian Pembayaran */}
          <div className="mb-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-2">
                Subtotal ({isCart ? (items ?? []).length : qtyNum} produk)
              </span>
              <span className="font-semibold text-ink">
                {formatRupiah(subtotal)}
              </span>
            </div>
            {allSelected && totalOngkir > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-2">
                  Ongkos Kirim
                  {groups.length > 1 ? ` (${groups.length} paket)` : ""}
                </span>
                <span className="font-semibold text-ink">
                  {formatRupiah(totalOngkir)}
                </span>
              </div>
            )}
            {codFeeAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-2">Biaya COD</span>
                <span className="font-semibold text-ink">
                  {formatRupiah(codFeeAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-1.5 text-base">
              <span className="font-bold text-ink">Total</span>
              <span className="font-extrabold text-brand">
                {formatRupiah(allSelected ? grandTotal : subtotal)}
              </span>
            </div>
          </div>

          {/* Tombol */}
          <button
            type="button"
            onClick={submit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#25D366]/25 transition-all hover:bg-[#1eb85a] hover:shadow-xl hover:shadow-[#25D366]/30 active:scale-[0.98]"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Buat Pesanan via WhatsApp
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-2">
            Pesanan akan dikirim ke WhatsApp admin untuk diproses
          </p>
        </div>
      </div>
    </div>
  );
}
