"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";
import { OPP_TYPES, type OppType } from "@/lib/opportunities/rules";

interface Quote {
  charging: boolean;
  price: number;
  freePerDay: number;
  freeLeftToday: number;
  nextUseCosts: boolean;
  balance: number | null;
}

const selectClass = "w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal";

export function FinderPanel({ projects, initialProject, ready }: { projects: { id: string; name: string }[]; initialProject: string | null; ready: boolean }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initialProject ?? projects[0]?.id ?? "");
  const [types, setTypes] = useState<OppType[]>(["guest_post", "directory", "resource_page"]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void apiRequest("/api/usage/quote?action=opportunity_search", "GET").then((res) => {
      if (alive) setQuote(res.ok ? ((res.data?.quote as Quote | undefined) ?? null) : null);
    });
    return () => {
      alive = false;
    };
  }, []);

  function toggle(id: OppType) {
    setTypes((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !projectId) return;
    if (types.length === 0) return setError("Choose at least one kind of opportunity.");
    if (quote?.nextUseCosts && !window.confirm(`This search costs ৳${quote.price}, taken from your wallet. If we can't deliver any result you are refunded automatically. Continue?`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await apiRequest("/api/opportunities/search", "POST", { project_id: projectId, types, request_id: crypto.randomUUID(), expected_price: quote?.price ?? 0 });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    const s = (res.data?.summary ?? {}) as Record<string, number>;
    if (!s.hits) setMessage("The search worked but found nothing new to show. Try other kinds, or add more keywords to the project." + (res.data?.refunded ? " You were not charged." : ""));
    else setMessage(`Done: ${s.added ?? 0} new, ${s.updated ?? 0} improved, ${s.unchanged ?? 0} already saved${s.skippedForCapacity ? `, ${s.skippedForCapacity} not saved (project is full)` : ""}. ${s.fromCache ? `${s.fromCache} of ${s.queries} searches were reused from earlier answers.` : ""}`);
    void apiRequest("/api/usage/quote?action=opportunity_search", "GET").then((r) => {
      if (r.ok) setQuote((r.data?.quote as Quote | undefined) ?? null);
    });
    router.refresh();
  }

  if (projects.length === 0) {
    return <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">Create a project first (with a niche and a few keywords). The finder searches for places that fit it.</p>;
  }

  return (
    <form onSubmit={run} className="space-y-4 rounded-chip border border-line bg-white p-5">
      <div>
        <label htmlFor="opp-project" className="mb-1 block text-sm text-muted">Project</label>
        <select id="opp-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectClass}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm text-muted">What to look for</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {OPP_TYPES.map((t) => (
            <label key={t.id} className="flex items-center gap-2">
              <input type="checkbox" checked={types.includes(t.id)} onChange={() => toggle(t.id)} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !ready || types.length === 0}>{busy ? "Searching…" : "Find opportunities"}</Button>
        {quote && (
          <span className="text-xs text-muted">
            {quote.charging && quote.price > 0 ? (quote.nextUseCosts ? `Next search costs ৳${quote.price}.` : `Free searches left today: ${quote.freeLeftToday}.`) : "No charge."}
          </span>
        )}
      </div>
      <p className="text-xs text-muted">
        Each search asks a web search service for pages that look like a fit. It uses official search services only; no website is scraped. The kind (guest post, directory…) is a guess from the search phrase, so always check the page before you contact anyone.
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-green-800">{message}</p>}
    </form>
  );
}
