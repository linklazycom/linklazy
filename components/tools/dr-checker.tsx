"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";
import { drBand } from "@/lib/ahrefs";

const BAND_TEXT = { new: "New site", growing: "Growing", established: "Established", strong: "Strong", elite: "Elite" } as const;

export function DrChecker() {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ domain: string; dr: number } | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await apiRequest("/api/tools/dr", "POST", { domain });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setResult({ domain: String(res.data?.domain ?? domain), dr: Number(res.data?.dr) });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={check} className="space-y-3 rounded-chip border border-line bg-white p-5">
        <label htmlFor="dr-domain" className="block text-sm font-medium">Website address</label>
        <input id="dr-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" maxLength={300} autoComplete="off" className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal" />
        <Button type="submit" disabled={busy || !domain.trim()}>{busy ? "Checking…" : "Check Domain Rating"}</Button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {result && (
        <div role="status" className="rounded-chip border border-line bg-paper p-5 text-center">
          <p className="text-sm text-muted">{result.domain}</p>
          <p className="font-display text-5xl font-semibold text-brand-violet">{result.dr}</p>
          <p className="text-sm text-muted">Domain Rating · {BAND_TEXT[drBand(result.dr)]}</p>
        </div>
      )}
      <p className="text-xs text-muted">
        Domain Rating (DR) is a 0–100 score from Ahrefs that estimates how strong a site&apos;s backlink profile is. It is an estimate, not a promise of rankings. Results may be up to a day old.
      </p>
    </div>
  );
}
