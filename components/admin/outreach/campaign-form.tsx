"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";
import { DAILY_CAP_CHOICES, MAX_LISTINGS } from "@/lib/outreach/campaign";
import { CONTACT_SOURCES } from "@/lib/outreach/rules";

const inputClass = "w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal";

export interface SiteOption {
  id: string;
  label: string;
}

export function CampaignForm({ sites, connected }: { sites: SiteOption[]; connected: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sequenceId, setSequenceId] = useState("");
  const [sequenceName, setSequenceName] = useState("");
  const [stepId, setStepId] = useState("");
  const [cap, setCap] = useState(20);
  const [tag, setTag] = useState("");
  const [country, setCountry] = useState("");
  const [source, setSource] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [sequences, setSequences] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState<"load" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);

  async function loadSequences() {
    if (busy) return;
    setBusy("load");
    setError(null);
    const res = await apiRequest("/api/admin/outreach/saleshandy", "POST", { action: "test" });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    const list = (res.data?.sequences as { id: string; name: string }[] | undefined) ?? [];
    setSequences(list);
    if (res.data?.ok === false) setError(String(res.data.message ?? "Could not load sequences."));
    else if (list.length === 0) setError("No sequences could be listed. Type the sequence id by hand.");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("create");
    setError(null);
    setField(null);
    const res = await apiRequest("/api/admin/outreach/campaigns", "POST", {
      name,
      sequence_id: sequenceId,
      sequence_name: sequenceName,
      step_id: stepId,
      daily_cap: cap,
      filter_tag: tag,
      filter_country: country,
      filter_source: source,
      site_ids: chosen,
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      setField(res.field ?? null);
      return;
    }
    setName("");
    setStepId("");
    setChosen([]);
    router.refresh();
  }

  const fe = (id: string) => field === id && error && <p className="mt-1 text-xs text-red-700">{error}</p>;

  return (
    <form onSubmit={create} className="space-y-4 rounded-chip border border-line bg-white p-5">
      <div>
        <h2 className="font-display text-lg font-medium">New campaign</h2>
        <p className="text-sm text-muted">A campaign starts paused. Create the sequence (the emails and follow-ups) in Saleshandy first, then connect it here.</p>
      </div>
      {!connected && <p className="rounded-chip border border-amber-300 bg-amber-50 p-3 text-sm">Connect Saleshandy first (Outreach &gt; Saleshandy). You can still prepare a campaign.</p>}

      <div>
        <label htmlFor="k-name" className="mb-1 block text-sm text-muted">Campaign name *</label>
        <input id="k-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Backlink buyers, October" />
        {fe("name")}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="k-seq" className="mb-1 block text-sm text-muted">Saleshandy sequence id *</label>
          <div className="flex gap-2">
            <input id="k-seq" value={sequenceId} maxLength={60} onChange={(e) => setSequenceId(e.target.value)} className={`${inputClass} font-mono`} />
            <Button type="button" size="sm" variant="secondary" disabled={busy !== null || !connected} onClick={loadSequences}>{busy === "load" ? "…" : "Load list"}</Button>
          </div>
          {sequences.length > 0 && (
            <select aria-label="Pick a sequence" className={`${inputClass} mt-2`} value={sequenceId} onChange={(e) => { setSequenceId(e.target.value); setSequenceName(sequences.find((s) => s.id === e.target.value)?.name ?? ""); }}>
              <option value="">Pick from your sequences…</option>
              {sequences.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
            </select>
          )}
          {fe("sequence_id")}
        </div>
        <div>
          <label htmlFor="k-step" className="mb-1 block text-sm text-muted">Step id (where new prospects start) *</label>
          <input id="k-step" value={stepId} maxLength={60} onChange={(e) => setStepId(e.target.value)} className={`${inputClass} font-mono`} />
          <p className="mt-1 text-xs text-muted">In Saleshandy, open the sequence and copy the id of its first step.</p>
          {fe("step_id")}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="k-cap" className="mb-1 block text-sm text-muted">Contacts per day</label>
          <select id="k-cap" value={cap} onChange={(e) => setCap(Number(e.target.value))} className={inputClass}>
            {DAILY_CAP_CHOICES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="k-tag" className="mb-1 block text-sm text-muted">Only tag (optional)</label>
          <input id="k-tag" value={tag} maxLength={30} onChange={(e) => setTag(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="k-country" className="mb-1 block text-sm text-muted">Only country (optional)</label>
          <input id="k-country" value={country} maxLength={2} onChange={(e) => setCountry(e.target.value.toUpperCase())} className={inputClass} placeholder="US" />
          {fe("filter_country")}
        </div>
        <div>
          <label htmlFor="k-source" className="mb-1 block text-sm text-muted">Only source (optional)</label>
          <select id="k-source" value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
            <option value="">Any</option>
            {CONTACT_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label.split(" (")[0]}</option>)}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted">Only contacts with status <strong>active</strong> are ever sent. Held, unsubscribed, bounced and blocked contacts are skipped automatically. Start at 20 a day and raise it slowly while bounces stay under 2%.</p>

      <fieldset>
        <legend className="mb-1 text-sm text-muted">Listings to feature (optional, up to {MAX_LISTINGS}; they take turns, one per contact)</legend>
        {sites.length === 0 ? (
          <p className="text-sm text-muted">No approved sites yet.</p>
        ) : (
          <div className="max-h-56 space-y-1 overflow-auto rounded-chip border border-line p-2 text-sm">
            {sites.map((s) => (
              <label key={s.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={chosen.includes(s.id)}
                  disabled={!chosen.includes(s.id) && chosen.length >= MAX_LISTINGS}
                  onChange={(e) => setChosen((c) => (e.target.checked ? [...c, s.id] : c.filter((x) => x !== s.id)))}
                />
                {s.label}
              </label>
            ))}
          </div>
        )}
        {fe("site_ids")}
      </fieldset>

      <Button type="submit" disabled={busy !== null || !name.trim() || !sequenceId.trim() || !stepId.trim()}>{busy === "create" ? "Creating…" : "Create campaign (paused)"}</Button>
      {error && !field && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
