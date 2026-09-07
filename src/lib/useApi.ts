"use client";

import { useEffect, useState } from "react";

/**
 * Minimal client-side data fetching hook with loading/error state.
 * Used to pull data from the internal /api/* routes (which scrape
 * anekadropship.id server-side).
 */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Start in loading state when a URL is provided, so the first render (and
  // SSR/hydration) shows a skeleton instead of flashing the "not found" state.
  const [loading, setLoading] = useState(Boolean(url));

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    // Intentionally reset the state whenever the URL changes.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    fetch(url)
      .then((r) => r.json())
      .then((json: { error?: string } & T) => {
        if (cancelled) return;
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, error, loading };
}
