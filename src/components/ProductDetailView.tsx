"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, MessageCircle, Package, ShieldCheck, ShoppingBag, Tag } from "lucide-react";
import { marketplaces } from "@/lib/config";
import { sanitizeHtml } from "@/lib/sanitize";
import MarketplaceIcon from "@/components/MarketplaceIcon";
import MarketplaceNotice from "@/components/MarketplaceNotice";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import WhatsAppOrderModal from "@/components/WhatsAppOrderModal";
import RelatedProducts from "@/components/RelatedProducts";
import type { AnekaProductDetail } from "@/lib/anekadropship";

const SIZE_RE =
  /^(?:XS|XXS|S|M|L|XL|XXL|XXXL|XXXXL|2XL|3XL|4XL|5XL|6XL|7XL|ALL\s*SIZE|ONE\s*SIZE|FREESIZE|SEMUA\s*UKURAN|JUMBO|KING\s*SIZE|QUEEN\s*SIZE|\d{1,4}(?:[.,]\d+)?\s*(?:CM|MM|INCH|INC|M|GR|G|ML|L)?|US\s*\d+(?:[.,]\d+)?|EU\s*\d+(?:[.,]\d+)?|\d{2,3}(?:-\d{2,3})?)$/i;

const COLOR_WORDS =
  /black|white|merah|hitam|putih|biru|kuning|hijau|pink|mocca|cream|krem|army|navy|maroon|abu|grey|gray|coklat|gold|golden|silver|orange|ungu|tosca|salem|peach|denim|khaki|mint|grape|latte|beige|olive|brown|red|blue|green|yellow|purple|bordeaux|mustard|cappuccino|dusty|sakura|lilac|sky|emerald|ruby|sapphire/i;

/** Pecah label varian supplier (mis. "BLACK - S") jadi warna + ukuran. */
function splitVariantLabel(label: string): { warna: string | null; ukuran: string | null } {
  const name = String(label ?? "").trim();
  if (!name) return { warna: null, ukuran: null };
  const parts = name.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (SIZE_RE.test(last)) {
      return { warna: parts.slice(0, -1).join(" - "), ukuran: last };
    }
    if (COLOR_WORDS.test(parts[0]) && SIZE_RE.test(parts[1])) {
      return { warna: parts[0], ukuran: parts.slice(1).join(" - ") };
    }
    return { warna: name, ukuran: null };
  }
  if (SIZE_RE.test(name)) return { warna: null, ukuran: name };
  return { warna: name, ukuran: null };
}

type VarOpt = { id: string; warna: string | null; ukuran: string | null; label: string; price: number | null; stock: number | null };

const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);

/** "69000.00" / "89.100,00" -> number|null */
function parseVariantPrice(s: string): number | null {
  const m = String(s ?? "").trim().match(/[\d][\d.,]*/);
  if (!m) return null;
  const raw = m[0];
  let n: number;
  if (raw.includes(",")) {
    n = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    n = parseFloat(raw.replace(/\./g, ""));
  } else {
    n = parseFloat(raw);
  }
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Varian aktif (stok > 0) -> opsi pilihan. */
function buildVariantOptions(detail: AnekaProductDetail): VarOpt[] {
  const out: VarOpt[] = [];
  for (const v of detail.variants ?? []) {
    if (v.isActive === false) continue;
    if (typeof v.stock === "number" && v.stock <= 0) continue;
    let warna = v.color?.trim() || null;
    let ukuran = v.size?.trim() || null;
    if (!warna && !ukuran) {
      const s = splitVariantLabel(v.name);
      warna = s.warna;
      ukuran = s.ukuran;
    }
    const price = parseVariantPrice(v.price);
    out.push({
      id: v.id,
      warna,
      ukuran,
      label: v.name || [warna, ukuran].filter(Boolean).join(" - "),
      price,
      stock: typeof v.stock === "number" && Number.isFinite(v.stock) ? v.stock : null,
    });
  }
  return out;
}

export default function ProductDetailView({ detail }: { detail: AnekaProductDetail }) {
  const [activeImg, setActiveImg] = useState(0);
  const [waOpen, setWaOpen] = useState(false);
  // Marketplace whose link was clicked but the product isn't uploaded there yet.
  const [missingMp, setMissingMp] = useState<string | null>(null);

  const varOpts = useMemo(() => buildVariantOptions(detail), [detail]);
  const warnaList = useMemo(
    () => [...new Set(varOpts.map((v) => v.warna).filter((x): x is string => Boolean(x)))],
    [varOpts]
  );
  const ukuranList = useMemo(
    () => [...new Set(varOpts.map((v) => v.ukuran).filter((x): x is string => Boolean(x)))],
    [varOpts]
  );
  const labelList = useMemo(
    () =>
      warnaList.length || ukuranList.length
        ? []
        : [...new Set(varOpts.map((v) => v.label).filter(Boolean))],
    [varOpts, warnaList, ukuranList]
  );

  const [selWarna, setSelWarna] = useState<string | null>(null);
  const [selUkuran, setSelUkuran] = useState<string | null>(null);
  const [selLabel, setSelLabel] = useState<string | null>(null);

  const activeVariant = useMemo(() => {
    if (!varOpts.length) return null;
    if (labelList.length) {
      return varOpts.find((v) => v.label === (selLabel ?? labelList[0])) ?? varOpts[0];
    }
    const warna = warnaList.length ? (selWarna ?? warnaList[0]) : null;
    const ukuran = ukuranList.length ? (selUkuran ?? ukuranList[0]) : null;
    const hit = varOpts.find((v) => v.warna === warna && v.ukuran === ukuran);
    return hit ?? varOpts[0];
  }, [varOpts, labelList, warnaList, ukuranList, selWarna, selUkuran, selLabel]);

  const images = detail.images.length ? detail.images : ["/placeholder.svg"];
  const active = images[Math.min(activeImg, images.length - 1)];
  const price = activeVariant?.price ? fmtRp(activeVariant.price) : detail.rekomendasiJual || "Rp -";
  const stokText = activeVariant?.stock != null ? String(activeVariant.stock) : detail.stok;
  const variantNote = activeVariant && varOpts.length ? activeVariant.label : "";


  return (
    <div className="container-site py-5 pb-24 lg:pb-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-2" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-brand">Beranda</Link>
        <span>/</span>
        <Link href="/produk" className="transition-colors hover:text-brand">Produk</Link>
        <span>/</span>
        <span className="truncate text-muted">{detail.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div className="min-w-0 lg:sticky lg:top-32 lg:self-start">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active}
              alt={detail.name}
              className="absolute inset-0 h-full w-full object-contain p-4"
            />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {images.map((img, i) => (
                <button
                  key={img + i}
                  onClick={() => setActiveImg(i)}
                  className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${i === activeImg ? "border-brand ring-1 ring-brand/30" : "border-gray-100 hover:border-gray-300"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-snug text-ink sm:text-2xl">{detail.name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-2">
            {detail.terjual && (
              <span className="inline-flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-brand" />
                <b className="text-ink">{detail.terjual}</b> terjual
              </span>
            )}
            {stokText && (
              <span className="inline-flex items-center gap-1.5">
                <Boxes className="h-4 w-4 text-brand" />
                Stok <b className="text-ink">{stokText}</b>
              </span>
            )}
          </div>

          {/* Price card */}
          <div className="mt-5 rounded-2xl border border-brand/15 bg-brand/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
              Harga
            </p>
            <p className="mt-1 text-3xl font-extrabold text-brand sm:text-4xl">
              {price}
            </p>
          </div>

          {/* Pemilih varian */}
          {varOpts.length > 0 && (
            <div className="mt-4 space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-2">
                <Tag className="h-3.5 w-3.5 text-brand" />
                Pilih Varian
                {activeVariant && <span className="ml-auto font-semibold normal-case tracking-normal text-brand">{activeVariant.label}</span>}
              </p>
              {warnaList.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-ink">Warna</p>
                  <div className="flex flex-wrap gap-1.5">
                    {warnaList.map((w) => {
                      const isSel = (selWarna ?? warnaList[0]) === w;
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setSelWarna(w)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            isSel
                              ? "border-brand bg-brand text-white"
                              : "border-gray-200 bg-white text-ink hover:border-brand"
                          }`}
                        >
                          {w}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {ukuranList.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-ink">Ukuran</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ukuranList.map((u) => {
                      const isSel = (selUkuran ?? ukuranList[0]) === u;
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setSelUkuran(u)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            isSel
                              ? "border-brand bg-brand text-white"
                              : "border-gray-200 bg-white text-ink hover:border-brand"
                          }`}
                        >
                          {u}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {labelList.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-ink">Varian</p>
                  <div className="flex flex-wrap gap-1.5">
                    {labelList.map((l) => {
                      const isSel = (selLabel ?? labelList[0]) === l;
                      return (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setSelLabel(l)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            isSel
                              ? "border-brand bg-brand text-white"
                              : "border-gray-200 bg-white text-ink hover:border-brand"
                          }`}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info pengiriman dari anekadropship (berat/volume/ekspedisi terkunci) */}
          {(detail.berat || detail.volume || detail.ekspedisi || detail.alamatSeller) && (
            <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-2">
                <Package className="h-3.5 w-3.5 text-brand" />
                Info Pengiriman
              </p>
              <dl className="mt-2 space-y-1.5 text-sm">
                {detail.berat && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-2">Berat</dt>
                    <dd className="font-medium text-ink">{detail.berat}</dd>
                  </div>
                )}
                {detail.volume && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-2">Volume</dt>
                    <dd className="font-medium text-ink">{detail.volume}</dd>
                  </div>
                )}
                {detail.ekspedisi && (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-2">Ekspedisi</dt>
                    <dd className="text-right font-medium text-ink">{detail.ekspedisi}</dd>
                  </div>
                )}
                {detail.sistem && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-2">Sistem</dt>
                    <dd className="font-medium text-ink">{detail.sistem}</dd>
                  </div>
                )}
                {detail.alamatSeller && (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-2">Dikirim dari</dt>
                    <dd className="text-right text-xs text-muted">{detail.alamatSeller}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* WhatsApp order */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setWaOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#1eb85a]"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Pesan via WhatsApp
            </button>
            <p className="mt-2 text-xs text-muted-2">
              Isi alamat penerima, pesanan langsung terkirim ke WhatsApp kami.
            </p>
          </div>

          {/* Order via marketplace */}
          <div className="mt-6">
            <p className="mb-3 text-sm font-bold text-ink">Beli di marketplace resmi:</p>
            {missingMp && (
              <MarketplaceNotice
                label={missingMp}
                onClose={() => setMissingMp(null)}
                className="mb-3"
              />
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              {marketplaces.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMissingMp(m.label)}
                  aria-label={`Beli via ${m.label}`}
                  className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:opacity-90"
                  style={{ backgroundColor: m.color }}
                >
                  <MarketplaceIcon name={m.key} variant="white" className="h-4 w-auto object-contain" />
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-2">
              <ShieldCheck className="h-4 w-4 text-brand" />
              Untuk saat ini pemesanan dilayani melalui WhatsApp.
            </p>
          </div>

          {/* Trust badges */}
          <div className="mt-6 grid grid-cols-1 gap-2 border-t border-gray-100 pt-5 sm:grid-cols-3 sm:text-center">
            {[
              { icon: Tag, label: "Harga Bersaing" },
              { icon: Package, label: "Info Stok Tercantum" },
              { icon: MessageCircle, label: "CS via WhatsApp" },
            ].map((t) => (
              <div
                key={t.label}
                className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5 sm:flex-col sm:gap-1 sm:px-2 sm:py-3"
              >
                <t.icon className="h-5 w-5 shrink-0 text-brand sm:mx-auto" />
                <p className="text-xs font-medium text-muted sm:mt-1">{t.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      {detail.descriptionHtml && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold text-ink sm:text-2xl">Deskripsi Produk</h2>
          <div
            className="deskripsi-produk rounded-2xl border border-gray-100 bg-white p-5 text-sm leading-6 shadow-sm sm:p-7"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(detail.descriptionHtml) }}
          />
        </section>
      )}

      {/* Related products */}
      <RelatedProducts productId={detail.id} productName={detail.name} />

      {/* Sticky mobile order bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 p-2.5 backdrop-blur lg:hidden">
        {missingMp && (
          <div className="mx-auto mb-2 max-w-2xl">
            <MarketplaceNotice label={missingMp} onClose={() => setMissingMp(null)} />
          </div>
        )}
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <div className="shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-2">Harga</p>
            <p className="max-w-28 truncate text-base font-extrabold text-brand">{price}</p>
          </div>
          <div className="ml-auto flex min-w-0 flex-1 max-w-sm items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setWaOpen(true)}
              aria-label="Pesan via WhatsApp"
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <WhatsAppIcon className="h-5 w-5" />
              WA
            </button>
            {marketplaces.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMissingMp(m.label)}
                aria-label={`Pesan via ${m.label}`}
                className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl px-1 text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: m.color }}
              >
                <MarketplaceIcon name={m.key} variant="white" className="h-3.5 w-auto max-w-full object-contain" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <WhatsAppOrderModal
        open={waOpen}
        onClose={() => setWaOpen(false)}
        productName={detail.name}
        price={price}
        variantLabel={variantNote}
        weight={detail.beratGram}
        weightLabel={detail.berat}
        volume={detail.volume}
        ekspedisi={detail.ekspedisiList}
        sellerAddress={detail.alamatSeller}
      />
    </div>
  );
}
