"use client";

import { Info, X } from "lucide-react";

type Props = {
  /** Marketplace label shown in the message, e.g. "Shopee". */
  label: string;
  onClose: () => void;
  className?: string;
  /** Override the default product-level message (e.g. for store-level links). */
  message?: React.ReactNode;
};

/**
 * Dismissible info banner shown when a marketplace link is clicked while the
 * product (or the store) has not been uploaded to that marketplace yet.
 */
export default function MarketplaceNotice({ label, onClose, className = "", message }: Props) {
  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 animate-fade-in ${className}`}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 leading-relaxed">
        {message ?? (
          <>
            Produk ini belum diupload ke <b>{label}</b>. Silakan pesan melalui
            WhatsApp untuk saat ini.
          </>
        )}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup informasi"
        className="shrink-0 rounded p-0.5 text-amber-600 transition-colors hover:text-amber-800"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
