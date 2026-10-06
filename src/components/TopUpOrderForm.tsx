"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send, Zap } from "lucide-react";
import {
  TOPUP_CATEGORIES,
  TOPUP_PRODUCTS,
  formatRupiah,
  type TopUpCategory,
  type TopUpProduct,
} from "@/lib/topup";
import { BANK_ACCOUNTS, whatsappLink } from "@/lib/config";

/** Daftar produk untuk satu kategori tampilan. */
const productsFor = (cat: TopUpCategory) => TOPUP_PRODUCTS.filter((p) => p.category === cat);

type OrderResponse = {
  ok?: boolean;
  error?: string;
  orderId?: string;
  mode?: "duitku" | "wa";
  paymentUrl?: string;
  waLink?: string;
  gatewayError?: string;
};

export default function TopUpOrderForm() {
  const router = useRouter();
  const [category, setCategory] = useState<TopUpCategory>(TOPUP_CATEGORIES[0].id);
  const [product, setProduct] = useState<TopUpProduct | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [target, setTarget] = useState("");
  const [server, setServer] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const bank = BANK_ACCOUNTS[0];
  // Nomor pelanggan (K-Vision) dibiarkan teks bebas; lainnya angka saja.
  const targetIsNumeric = product?.customerNoLabel !== "Nomor Pelanggan";

  /** Validasi form — mengembalikan pesan error atau null bila lolos. */
  const validate = (): string | null => {
    if (!product) return "Silakan pilih produk terlebih dahulu.";
    if (!name.trim() || !target.trim())
      return `Mohon lengkapi Nama dan ${product.customerNoLabel}.`;
    if (product.needsServer && !server.trim())
      return "Mohon isi Server/Zone untuk produk Mobile Legends.";
    return null;
  };

  /** Jalur manual: buka WhatsApp dengan draf pesanan (transfer bank, CS
   *  memverifikasi lalu eksekusi dari /topup/admin). */
  const openWaDraft = () => {
    if (!product) return;
    const lines = [
      "Halo, saya ingin melakukan top up:",
      "",
      `Produk: ${product.name}`,
      `${product.customerNoLabel}: ${target.trim()}`,
    ];
    if (product.needsServer) lines.push(`Server: ${server.trim()}`);
    lines.push(
      `Total: ${formatRupiah(product.sellPrice)}`,
      "",
      "Data Pemesan:",
      `Nama: ${name.trim()}`,
      `No. HP: ${phone.trim() || "-"}`,
      "",
      `Pembayaran akan saya transfer ke rekening ${bank.bank} ${bank.accountNumber} a.n. ${bank.accountName} dan bukti transfer saya lampirkan di chat ini.`,
    );
    window.open(whatsappLink(lines.join("\n")), "_blank", "noopener,noreferrer");
  };

  /** Alur utama: buat pesanan di server → halaman bayar Duitku (atau
   *  fallback WhatsApp bila gateway belum aktif / nominal < Rp 10.000). */
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
          sku: product!.sku,
          id: target.trim(),
          server: server.trim(),
          buyerName: name.trim(),
          buyerPhone: phone.trim(),
        }),
      });
      const j = (await res.json()) as OrderResponse;
      if (j.ok && j.mode === "duitku" && j.orderId) {
        router.push(`/topup/bayar/${j.orderId}`);
        return;
      }
      if (j.ok && j.mode === "wa" && j.orderId) {
        // Gateway belum aktif / sesi gagal — pesanan tetap tercatat, pembeli
        // lanjut verifikasi manual via WhatsApp.
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

  if (sent && product) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <h3 className="text-lg font-bold text-ink">Pesanan Tercatat — WhatsApp Terbuka</h3>
        <p className="max-w-md text-sm text-muted">
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
    <form onSubmit={submit} id="topup-form" className="space-y-5" noValidate>
      {/* Pilih kategori */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Pilih Kategori</p>
        <div className="flex flex-wrap gap-2">
          {TOPUP_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCategory(c.id);
                setProduct(null);
                setTarget("");
                setServer("");
              }}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                category === c.id
                  ? "border-brand bg-brand text-white"
                  : "border-gray-200 bg-white text-ink hover:border-brand hover:text-brand"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pilih produk */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Pilih Produk</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {productsFor(category).map((p) => (
            <button
              key={p.sku}
              type="button"
              onClick={() => setProduct(p)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                product?.sku === p.sku
                  ? "border-brand bg-brand/5 ring-2 ring-brand/20"
                  : "border-gray-200 bg-white hover:border-brand"
              }`}
            >
              <p className="text-xs font-medium leading-snug text-ink">{p.name}</p>
              <p className="mt-1 text-sm font-bold text-brand">{formatRupiah(p.sellPrice)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Data pemesan */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tu-name" className="mb-1.5 block text-sm font-semibold text-ink">
            Nama Lengkap <span className="text-red-500">*</span>
          </label>
          <input
            id="tu-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama pemesan"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div>
          <label htmlFor="tu-phone" className="mb-1.5 block text-sm font-semibold text-ink">
            No. HP Pemesan
          </label>
          <input
            id="tu-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx (untuk notifikasi WhatsApp)"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tu-target" className="mb-1.5 block text-sm font-semibold text-ink">
            {product?.customerNoLabel ?? "Nomor Tujuan"} <span className="text-red-500">*</span>
          </label>
          <input
            id="tu-target"
            type="text"
            inputMode={targetIsNumeric ? "numeric" : "text"}
            value={target}
            onChange={(e) =>
              setTarget(targetIsNumeric ? e.target.value.replace(/\D/g, "") : e.target.value)
            }
            placeholder={product?.customerNoLabel.includes("HP") ? "08xxxxxxxxxx" : "Contoh: 12345678"}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {product && (
            <p className="mt-1 text-[11px] text-muted-2">
              {product.category === "game"
                ? "Cek ID di profil game Anda (pastikan benar — top up yang salah ID tidak dapat dikembalikan)."
                : product.category === "pln"
                  ? "Nomor meter tertera di meteran PLN atau ID pelanggan di struk/tagihan listrik."
                  : "Pastikan nomor benar — pengisian ke nomor yang salah tidak dapat dikembalikan."}
            </p>
          )}
        </div>
        {product?.needsServer && (
          <div>
            <label htmlFor="tu-server" className="mb-1.5 block text-sm font-semibold text-ink">
              Server / Zone <span className="text-red-500">*</span>
            </label>
            <input
              id="tu-server"
              type="text"
              inputMode="numeric"
              value={server}
              onChange={(e) => setServer(e.target.value.replace(/\D/g, ""))}
              placeholder="Contoh: 1234"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {/* Ringkasan + tombol */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <div>
          <p className="text-xs text-muted-2">Total Pembayaran</p>
          <p className="text-xl font-extrabold text-brand">
            {product ? formatRupiah(product.sellPrice) : "—"}
          </p>
          {product?.needsServer && target && server && (
            <p className="mt-0.5 text-[11px] text-muted-2">
              ID {target} • Server {server}
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted">
            Bayar via QRIS / Virtual Account — pengisian otomatis setelah pembayaran terverifikasi.
          </p>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? "Membuat Pesanan..." : "Bayar Sekarang"}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <p className="flex items-start gap-2 leading-relaxed">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          Pengisian diproses otomatis setelah pembayaran terverifikasi, biasanya dalam
          beberapa menit.
        </p>
        <button
          type="button"
          onClick={openWaDraft}
          className="shrink-0 font-semibold text-muted-2 underline-offset-2 transition-colors hover:text-brand hover:underline"
        >
          Pesan via WhatsApp (transfer manual)
        </button>
      </div>
    </form>
  );
}
