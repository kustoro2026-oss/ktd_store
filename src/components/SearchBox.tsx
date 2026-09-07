"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Search } from "lucide-react";
import { recentSearches } from "@/lib/data";

const RECENT_KEY = "ktd-store-recent-searches";
const MAX_RECENT = 5;
const MAX_SUGGESTIONS = 8;
const DEBOUNCE_MS = 150;

type Suggestion = { id: string; name: string; image: string };

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        return parsed.slice(0, MAX_RECENT);
      }
    }
  } catch {
    // SSR / private mode / corrupt storage
  }
  return [];
}

/** Product name with the first case-insensitive occurrence of `query` highlighted. */
function HighlightedName({ name, query }: { name: string; query: string }) {
  const idx = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (idx === -1) return <>{name}</>;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="bg-transparent font-semibold text-brand">
        {name.slice(idx, idx + query.length)}
      </mark>
      {name.slice(idx + query.length)}
    </>
  );
}

type Props = {
  /** "desktop" renders the full-width header bar, "mobile" the compact one. */
  variant: "desktop" | "mobile";
  /** Called after every navigation triggered from this box (e.g. close header menus). */
  onNavigate?: () => void;
};

export default function SearchBox({ variant, onNavigate }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [loading, setLoading] = useState(false);
  // Suggestions are bound to the query they were fetched for, so stale
  // responses from aborted requests are never rendered.
  const [result, setResult] = useState<{ q: string; items: Suggestion[] } | null>(null);
  const [active, setActive] = useState(-1);

  const q = query.trim();
  const suggestions = result && result.q === q ? result.items : [];
  // True only once the response for the CURRENT query has arrived — until
  // then we show the loading skeleton instead of a misleading "no results".
  const hasResultForQ = Boolean(result && result.q === q);
  const recentList = recent.length ? recent : recentSearches;
  // Rows for keyboard navigation: one per suggestion + "lihat semua hasil".
  const rowCount = q ? suggestions.length + 1 : 0;

  const saveSearch = (term: string) => {
    const next = [term, ...recent.filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(
      0,
      MAX_RECENT,
    );
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // ignore private mode / quota errors
    }
  };

  const goSearch = (term: string) => {
    saveSearch(term);
    // Clear the input so the searched keyword doesn't linger in the box
    // after navigating to the results page.
    setQuery("");
    setResult(null);
    setActive(-1);
    setOpen(false);
    onNavigate?.();
    router.push(`/produk?search=${encodeURIComponent(term)}`);
  };

  const goProduct = (s: Suggestion) => {
    saveSearch(s.name);
    setQuery("");
    setResult(null);
    setActive(-1);
    setOpen(false);
    onNavigate?.();
    router.push(`/produk/${s.id}`);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q) return;
    goSearch(q);
  };

  // Debounced live suggestions while typing.
  useEffect(() => {
    const term = q;
    if (!term) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setActive(-1);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const json = (await res.json()) as { suggestions?: Suggestion[] };
        if (!controller.signal.aborted) {
          setResult({ q: term, items: (json.suggestions ?? []).slice(0, MAX_SUGGESTIONS) });
        }
      } catch {
        // Aborted (user kept typing) or a transient network error. Record an
        // empty result for this query so the UI shows the "no products"
        // state instead of an endless skeleton.
        if (!controller.signal.aborted) setResult({ q: term, items: [] });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!q || rowCount === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % rowCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? rowCount - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      if (active < suggestions.length) goProduct(suggestions[active]);
      else goSearch(q);
    }
  };

  const dropdownContent = (
    <>
      {q === "" ? (
        <div className="pb-1.5">
          <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-2">
            Pencarian terbaru
          </p>
          {recentList.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={() => goSearch(s)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-muted transition-colors hover:bg-gray-50 hover:text-brand"
            >
              <Clock className="h-4 w-4 text-muted-2" />
              {s}
            </button>
          ))}
        </div>
      ) : loading || !hasResultForQ ? (
        <div className="space-y-2.5 p-3" aria-label="Mencari produk">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex animate-pulse items-center gap-2.5">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-gray-100" />
              <div className="h-3 flex-1 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : suggestions.length > 0 ? (
        <>
          <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-2">
            Produk
          </p>
          <ul>
            {suggestions.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={() => goProduct(s)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors ${i === active ? "bg-gray-50" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.image}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg border border-gray-100 object-cover"
                  />
                  <span className="truncate text-sm text-ink">
                    <HighlightedName name={s.name} query={q} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onMouseDown={() => goSearch(q)}
            onMouseEnter={() => setActive(suggestions.length)}
            className={`flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm font-semibold text-brand transition-colors hover:bg-brand/5 ${suggestions.length === active ? "bg-brand/5" : ""}`}
          >
            <Search className="h-4 w-4" />
            Lihat semua hasil untuk &ldquo;{q}&rdquo;
            <ArrowRight className="ml-auto h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <p className="px-4 py-3 text-sm text-muted">
            Tidak ada produk untuk &ldquo;{q}&rdquo;.
          </p>
          <button
            type="button"
            onMouseDown={() => goSearch(q)}
            className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm font-semibold text-brand transition-colors hover:bg-brand/5"
          >
            <Search className="h-4 w-4" />
            Cari &ldquo;{q}&rdquo; di semua produk
          </button>
        </>
      )}
    </>
  );

  if (variant === "desktop") {
    return (
      <form onSubmit={submitSearch} className="relative hidden flex-1 md:block">
        <div className="flex items-center overflow-hidden rounded-lg bg-white text-ink ring-1 ring-transparent transition-shadow focus-within:ring-white/50">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            placeholder="Cari produk di KTD Store..."
            autoComplete="off"
            role="combobox"
            aria-label="Cari produk"
            aria-autocomplete="list"
            aria-controls="ktd-search-list-desktop"
            aria-expanded={open}
            className="min-w-0 w-full px-4 py-2.5 text-sm text-ink outline-none placeholder:text-muted-2"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 border-l border-gray-100 px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-gray-50"
          >
            <Search className="h-4 w-4" />
            Cari
          </button>
        </div>
        {open && (
          <div
            id="ktd-search-list-desktop"
            className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg bg-white text-ink shadow-xl ring-1 ring-black/5"
          >
            {dropdownContent}
          </div>
        )}
      </form>
    );
  }

  return (
    <form
      onSubmit={submitSearch}
      className="relative flex items-center overflow-hidden rounded-lg bg-white text-ink"
    >
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder="Cari produk di KTD Store..."
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-label="Cari produk"
        aria-autocomplete="list"
        aria-controls="ktd-search-list-mobile"
        aria-expanded={open}
        className="min-w-0 w-full px-4 py-2.5 text-base text-ink outline-none placeholder:text-muted-2"
      />
      <button
        type="submit"
        aria-label="Cari"
        className="flex shrink-0 items-center gap-1.5 border-l border-gray-100 px-3.5 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-gray-50"
      >
        <Search className="h-4 w-4" />
        <span>Cari</span>
      </button>
      {open && (
        <div
          id="ktd-search-list-mobile"
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg bg-white text-ink shadow-xl ring-1 ring-black/5"
        >
          {dropdownContent}
        </div>
      )}
    </form>
  );
}
