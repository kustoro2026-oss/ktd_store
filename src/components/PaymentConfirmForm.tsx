"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { whatsappLink } from "@/lib/config";

const PAYMENT_METHODS = [
  "Transfer Bank BCA",
  "Transfer Bank BRI",
  "Transfer Bank Mandiri",
  "DANA",
  "OVO",
  "GoPay",
  "ShopeePay",
];

export default function PaymentConfirmForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [product, setProduct] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !product.trim() || !amount.trim()) {
      setError("Mohon lengkapi Nama, Produk yang Dipesan, dan Jumlah Dibayar.");
      return;
    }
    const lines = [
      "Halo, saya ingin konfirmasi pembayaran:",
      "",
      `Nama: ${name.trim()}`,
      `No. HP: ${phone.trim() || "-"}`,
      `Produk yang Dipesan: ${product.trim()}`,
      `Metode Pembayaran: ${method}`,
      `Jumlah Dibayar: ${amount.trim()}`,
    ];
    if (note.trim()) lines.push(`Catatan: ${note.trim()}`);
    lines.push("", "Bukti transfer akan saya lampirkan di chat ini.");
    window.open(whatsappLink(lines.join("\n")), "_blank", "noopener,noreferrer");
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <h3 className="text-lg font-bold text-ink">WhatsApp Terbuka</h3>
        <p className="max-w-md text-sm text-muted">
          Kami sudah menyiapkan pesan konfirmasi Anda di WhatsApp. Silakan lampirkan
          bukti transfer di chat tersebut, lalu kirim.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-2 rounded-xl border border-emerald-200 px-5 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          Kirim Konfirmasi Lain
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} id="pc-form" className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pc-name" className="mb-1.5 block text-sm font-semibold text-ink">
            Nama Lengkap <span className="text-red-500">*</span>
          </label>
          <input
            id="pc-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama sesuai pesanan"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div>
          <label htmlFor="pc-phone" className="mb-1.5 block text-sm font-semibold text-ink">
            No. HP
          </label>
          <input
            id="pc-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      <div>
        <label htmlFor="pc-product" className="mb-1.5 block text-sm font-semibold text-ink">
          Produk yang Dipesan <span className="text-red-500">*</span>
        </label>
        <input
          id="pc-product"
          type="text"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          placeholder="Contoh: Sepatu Sneakers Putih Ukuran 42"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pc-method" className="mb-1.5 block text-sm font-semibold text-ink">
            Metode Pembayaran
          </label>
          <select
            id="pc-method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pc-amount" className="mb-1.5 block text-sm font-semibold text-ink">
            Jumlah Dibayar <span className="text-red-500">*</span>
          </label>
          <input
            id="pc-amount"
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Contoh: Rp 150.000"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      <div>
        <label htmlFor="pc-note" className="mb-1.5 block text-sm font-semibold text-ink">
          Catatan <span className="font-normal text-muted-2">(opsional)</span>
        </label>
        <textarea
          id="pc-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Info tambahan, misal: transfer lewat rekening atas nama..."
          className="w-full resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-2 sm:w-auto"
      >
        <Send className="h-4 w-4" />
        Kirim Konfirmasi via WhatsApp
      </button>
    </form>
  );
}
