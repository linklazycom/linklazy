"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  domain: string;
  niche: string;
  da: number | null;
  dr: number | null;
  dr_verified: number | null;
  price_amount: number | null;
  link_type: string;
}

/**
 * Debounced autocomplete over /api/search. `browseHref` lets the two
 * headers (marketing vs dashboard) point results at the right detail
 * route — /browse/[id] for logged-out visitors, /dashboard/browse/[id]
 * for authenticated users.
 */
export function GlobalSearch({
  browseHref = "/browse",
  className,
  placeholder = "Search sites by domain or niche…",
}: {
  browseHref?: string;
  className?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const body = await res.json();
        setResults(body.results ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function goToSite(id: string) {
    setOpen(false);
    setQuery("");
    router.push(`${browseHref}/${id}`);
  }

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-xs", className)}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-chip border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-signal"
      />
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-chip border border-line bg-white shadow-lg">
          {loading && <p className="p-3 text-xs text-muted">Searching…</p>}
          {!loading && !results.length && (
            <p className="p-3 text-xs text-muted">No sites match &quot;{query}&quot;.</p>
          )}
          {!loading &&
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => goToSite(r.id)}
                className="block w-full border-b border-line px-3 py-2 text-left text-sm last:border-b-0 hover:bg-paper"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-medium">{r.domain}</span>
                  {r.price_amount != null && (
                    <span className="text-xs text-muted">৳{r.price_amount}</span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted">
                  <span>{r.niche}</span>
                  {r.da != null && <span>DA {r.da}</span>}
                  {(r.dr_verified ?? r.dr) != null && <span>DR {r.dr_verified ?? r.dr}</span>}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
