"use client";

import { useEffect, useState, use as usePromise } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MetricChip } from "@/components/ui/metric-chip";
import { computeMatchScore } from "@/lib/match-score";

interface Candidate {
  id: string;
  domain: string;
  niche: string;
  da: number | null;
  dr: number | null;
  organic_traffic: number | null;
  score: number;
}

export default function SiteMatchesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const supabase = createClient();
  const [mySite, setMySite] = useState<{ id: string; domain: string; niche: string; da: number | null } | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [proposingTo, setProposingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function load() {
    const { data: site } = await supabase
      .from("sites")
      .select("id, domain, niche, da")
      .eq("id", id)
      .single();
    setMySite(site);
    if (!site) return;

    const { data: others } = await supabase
      .from("sites")
      .select("id, domain, niche, da, dr, organic_traffic")
      .eq("status", "approved")
      .eq("accepts_exchange", true)
      .neq("id", id);

    const scored = (others ?? [])
      .map((o) => ({ ...o, score: computeMatchScore(site, o) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
    setCandidates(scored);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handlePropose(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!proposingTo) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_a_id: id,
        site_b_id: proposingTo,
        my_target_url: form.get("my_target_url"),
        my_anchor_text: form.get("my_anchor_text"),
        their_target_url: form.get("their_target_url"),
        their_anchor_text: form.get("their_anchor_text"),
        notes: form.get("notes") || undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Could not send proposal.");
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    setProposingTo(null);
  }

  if (!mySite) return <p className="text-muted">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-medium">Find exchange partners — {mySite.domain}</h1>
      <p className="mb-6 text-sm text-muted">
        Suggested based on similar DA and niche. Higher scores mean a closer
        match. Propose an exchange and the other owner can accept, counter,
        or decline.
      </p>

      {success && (
        <div className="mb-6 rounded-chip border border-signal/30 bg-signal-soft p-4 text-sm">
          Proposal sent. You can track its status from{" "}
          <a href="/dashboard/matches" className="underline">
            your matches list
          </a>
          .
        </div>
      )}

      <div className="space-y-3">
        {candidates.map((c) => (
          <div key={c.id} className="rounded-chip border border-line bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">{c.domain}</span>
              <MetricChip
                label="Match"
                value={`${c.score}%`}
                tone={c.score >= 70 ? "verified" : c.score >= 40 ? "price" : "default"}
              />
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <MetricChip label="Niche" value={c.niche} />
              {c.da != null && <MetricChip label="DA" value={c.da} />}
              {c.dr != null && <MetricChip label="DR" value={c.dr} />}
              {c.organic_traffic != null && <MetricChip label="Traffic" value={`${c.organic_traffic}/mo`} />}
            </div>

            {proposingTo === c.id ? (
              <form onSubmit={handlePropose} className="space-y-3 border-t border-line pt-3">
                <p className="text-xs font-medium text-muted">Your link (on their site)</p>
                <Field id="my_target_url" name="my_target_url" label="Page they should link to" placeholder="https://yoursite.com/page" required />
                <Field id="my_anchor_text" name="my_anchor_text" label="Anchor text" required />
                <p className="pt-2 text-xs font-medium text-muted">Their link (on your site)</p>
                <Field id="their_target_url" name="their_target_url" label="Page you'll link to" placeholder="https://theirsite.com/page" required />
                <Field id="their_anchor_text" name="their_anchor_text" label="Anchor text" required />
                <div>
                  <label htmlFor="notes" className="mb-1 block text-sm text-muted">Notes (optional)</label>
                  <textarea id="notes" name="notes" rows={2} className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-brand-violet" />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={submitting}>
                    {submitting ? "Sending…" : "Send proposal"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setProposingTo(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setProposingTo(c.id)}>
                Propose exchange
              </Button>
            )}
          </div>
        ))}
        {!candidates.length && <p className="text-muted">No exchange-eligible sites found yet.</p>}
      </div>
    </div>
  );
}
