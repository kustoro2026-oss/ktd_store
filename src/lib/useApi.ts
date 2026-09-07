"use client";

import { useEffect, useState } from "react";

/**
 * Minimal client-side data fetching hook with loading/error state and a
 * session-level cache (stale-while-revalidate). Used to pull data from the
 * internal /api/* routes (which scrape anekadropship.id server-side).
 *
 * Repeated visits to the same URL within a session render instantly from the
 * cache (no skeleton flash), while a background revalidation keeps the data
 * fresh. This keeps navigation between pages fast without hammering the
 * scraper-backed API routes.
 */

const CACHE_TTL = 60_000; // serve the cached copy without refetching
const STALE_TTL = 10 * 60_000; // keep serving stale data up to 10 minutes
const MAX_ENTRIES = 80;

type Entry<T> = { data: T; ts: number; promise: Promise<T> | null };

const cache = new Map<string, Entry<unknown>>();

function prune(now: number) {
  for (const [key, entry] of cache) {
    if (now - entry.ts > STALE_TTL) cache.delete(key);
  }
  // Still over the cap — evict the oldest entries.
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function useApi<T>(url: string | null) {
  const entry = url ? (cache.get(url) as Entry<T> | undefined) : undefined;

  // Seed state synchronously from the cache so cached pages render instantly.
  // When only a promise is in flight (no data yet), start in loading state.
  const [data, setData] = useState<T | null>(entry?.data ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url) && !entry?.data);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    const existing = cache.get(url) as Entry<T> | undefined;

    // Another component is already fetching this URL — share its result.
    if (existing?.promise) {
      existing.promise
        .then((json) => {
          if (!cancelled) {
            setData(json);
            setError(null);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
      return;
    }

    // Fresh entry — data was already seeded from the cache. Skip the network.
    if (existing && Date.now() - existing.ts < CACHE_TTL) return;

    const promise = fetch(url)
      .then((r) => r.json())
      .then((json: { error?: string } & T) => {
        if (json.error) throw new Error(json.error);
        return json;
      });

    cache.set(url, { data: existing?.data, ts: existing?.ts ?? 0, promise });

    promise
      .then((json) => {
        prune(Date.now());
        cache.set(url, { data: json, ts: Date.now(), promise: null });
        if (!cancelled) {
          setData(json);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        // Keep serving the stale copy when the revalidation fails.
        if (existing?.data) {
          cache.set(url, { data: existing.data, ts: existing.ts, promise: null });
        } else {
          cache.delete(url);
        }
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Gagal memuat data");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, error, loading };
}
