"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/currency/money";
import { apiRequest } from "@/components/links/api";
import { NICHES } from "@/lib/niches";

interface Site { id: string; niche: string; dr: number | null; da: number | null; price_amount: number | null; turnaround_hours: number | null }
interface Out { niche: string; confidence: number; matchedKeywords: string[]; totalInNiche: number; sites: Site[] }

export function RecommendationsForm() {
  const [url, setUrl] = useState("");
  const [niche, setNiche] = useState("");
  const [needNiche, setNeedNiche] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<Out | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setOut(null);
    const body = niche ? { manual_niche: niche } : { url };
    const res = await apiRequest("/api/recommendations", "POST", body);
    setBusy(false);
    if (!res.ok) {
      if (res.status === 422 || res.status === 502) setNeedNiche(true);
      return setError(res.error);
    }
    setOut({
      niche: String(res.data?.niche ?? ""),
      confidence: Number(res.data?.confidence ?? 0),
      matchedKeywords: (res.data?.matchedKeywords as string[]) ?? [],
      totalInNiche: Number(res.data?.totalInNiche ?? 0),
      sites: (res.data?.sites as Site[]) ?? [],
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={run} className="space-y-3 rounded-chip border border-line bg-white p-5">
        <label htmlFor="rec-url" className="block text-sm font-medium">Your website address</label>
        <input id="rec-url" value={url} onChange={(e) => { setUrl(e.target.value); if (niche) setNiche(""); }} placeholder="https://example.com" maxLength={2048} autoComplete="off" className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal" />
        {needNiche && (
          <div>
            <label htmlFor="rec-niche" className="block text-sm font-medium">Or pick your niche</label>
            <select id="rec-niche" value={niche} onChange={(e) => setNiche(e.target.value)} className="mt-1 w-full rounded-chip border border-line bg-white px-3 py-2 text-sm">
              <option value="">Choose…</option>
              {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
        <Button type="submit" disabled={busy || (!url.trim() && !niche)}>{busy ? "Looking…" : "Find sites"}</Button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {out && (
        <div role="status" className="space-y-4">
          <p className="text-sm">
            Niche: <strong>{out.niche}</strong>
            {out.confidence > 0 && out.confidence < 100 ? <span className="text-muted"> (detected, {Math.round(out.confidence)}% sure{out.matchedKeywords.length ? `: ${out.matchedKeywords.join(", ")}` : ""})</span> : null}
          </p>
          {out.sites.length === 0 ? (
            <p className="rounded-chip border border-line bg-paper p-4 text-sm text-muted">No listed sites in this niche yet. <Link href="/browse" className="text-brand-violet underline">Browse all listings</Link>.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {out.sites.map((s) => (
                  <li key={s.id}>
                    <Link href={`/browse/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-chip border border-line bg-white p-4 text-sm hover:bg-paper">
                      <span className="font-medium">{s.niche}</span>
                      <span className="text-muted">DR {s.dr ?? "—"} · DA {s.da ?? "—"}{s.turnaround_hours ? ` · ${s.turnaround_hours}h turnaround` : ""}</span>
                      <span className="font-medium">{s.price_amount != null ? <Money amount={s.price_amount} /> : "Exchange only"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted">Showing the best {out.sites.length} of {out.totalInNiche} listed in this niche. <Link href="/register" className="text-brand-violet underline">Create a free account</Link> to see them all and place an order.</p>
            </>
          )}
        </div>
      )}
      <p className="text-xs text-muted">We read only the page you enter, once, to guess its niche from its title and headings. We do not store your address. Matches are a starting point, not a guarantee of results.</p>
    </div>
  );
}
