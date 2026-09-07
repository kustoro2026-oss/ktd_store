"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="container-site py-24 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-ink">Terjadi Kesalahan</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Maaf, terjadi kendala saat memuat halaman. Silakan coba lagi dalam
        beberapa saat.
      </p>
      <button
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2"
      >
        Coba Lagi
      </button>
    </div>
  );
}
