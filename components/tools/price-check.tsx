"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/currency/money";
import { apiRequest } from "@/components/links/api";
import { NICHES } from "@/lib/niches";

interface Stats { count: number; min: number; p25: number; median: number; p75: number; max: number }

export function PriceCheck() {
  const [dr, setDr] = useState("");
  const [niche, setNiche] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<{ range: [number, number]; niche: string | null; listings: number; minSamples: number; stats: Stats | null } | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setOut(null);
    const qs = new URLSearchParams({ dr });
    if (niche) qs.set("niche", niche);
    const res = await apiRequest(`/api/tools/price-check?${qs.toString()}`, "GET");
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOut({
      range: res.data?.range as [number, number],
      niche: (res.data?.niche as string | null) ?? null,
      listings: Number(res.data?.listings ?? 0),
      minSamples: Number(res.data?.minSamples ?? 5),
      stats: (res.data?.stats as Stats | null) ?? null,
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={run} className="space-y-3 rounded-chip border border-line bg-white p-5">
        <div>
          <label htmlFor="pc-dr" className="block text-sm font-medium">Domain Rating (0–100)</label>
          <input id="pc-dr" inputMode="numeric" value={dr} onChange={(e) => setDr(e.target.value)} placeholder="e.g. 40" maxLength={3} className="mt-1 w-32 rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal" />
        </div>
        <div>
          <label htmlFor="pc-niche" className="block text-sm font-medium">Niche (optional)</label>
          <select id="pc-niche" value={niche} onChange={(e) => setNiche(e.target.value)} className="mt-1 w-full rounded-chip border border-line bg-white px-3 py-2 text-sm">
            <option value="">Any niche</option>
            {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <Button type="submit" disabled={busy || !dr.trim()}>{busy ? "Checking…" : "Check prices"}</Button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {out && (
        <div role="status" className="rounded-chip border border-line bg-paper p-5 text-sm">
          {out.stats ? (
            <>
              <p className="mb-3 text-muted">
                From {out.stats.count} LinkLazy listings with Domain Rating {out.range[0]}–{out.range[1]}{out.niche ? ` in ${out.niche}` : ""}:
              </p>
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div><dt className="text-xs text-muted">Lowest</dt><dd className="font-display text-lg"><Money amount={out.stats.min} /></dd></div>
                <div><dt className="text-xs text-muted">Typical (median)</dt><dd className="font-display text-xl text-brand-violet"><Money amount={out.stats.median} /></dd></div>
                <div><dt className="text-xs text-muted">Highest</dt><dd className="font-display text-lg"><Money amount={out.stats.max} /></dd></div>
              </dl>
              <p className="mt-3 text-center text-xs text-muted">Middle half of listings: <Money amount={out.stats.p25} /> to <Money amount={out.stats.p75} /></p>
            </>
          ) : (
            <p className="text-muted">
              Not enough data yet: only {out.listings} listing{out.listings === 1 ? "" : "s"} match (we need at least {out.minSamples} to show a price range). Try a wider niche, or browse listings directly.
            </p>
          )}
        </div>
      )}
      <p className="text-xs text-muted">
        These numbers come only from sites currently listed on LinkLazy, not from the wider market. They show what sellers here ask, not what a link is &quot;worth&quot;.
      </p>
    </div>
  );
}
