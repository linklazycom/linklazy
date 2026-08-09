"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MetricChip } from "@/components/ui/metric-chip";

interface Terms {
  from_a: { target_url: string; anchor_text: string };
  from_b: { target_url: string; anchor_text: string };
  notes?: string;
}

interface MatchDetail {
  id: string;
  status: string;
  match_score: number | null;
  initiated_by: string;
  proposed_terms: Terms;
  counter_terms: Terms | null;
  site_a: { id: string; owner_id: string; domain: string };
  site_b: { id: string; owner_id: string; domain: string };
}

export default function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const router = useRouter();
  const supabase = createClient();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showCounter, setShowCounter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user!.id);

    const { data } = await supabase
      .from("exchange_matches")
      .select("id, status, match_score, initiated_by, proposed_terms, counter_terms, site_a:site_a_id(id, owner_id, domain), site_b:site_b_id(id, owner_id, domain)")
      .eq("id", id)
      .single();
    setMatch(data as unknown as MatchDetail);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function respond(action: "accept" | "reject") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/matches/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not respond.");
      setBusy(false);
      return;
    }
    if (action === "accept") {
      router.push("/dashboard/orders");
      return;
    }
    setBusy(false);
    load();
  }

  async function submitCounter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const res = await fetch(`/api/matches/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "counter",
        counter_terms: {
          from_a: {
            target_url: form.get("my_target_url"),
            anchor_text: form.get("my_anchor_text"),
          },
          from_b: {
            target_url: form.get("their_target_url"),
            anchor_text: form.get("their_anchor_text"),
          },
          notes: form.get("notes") || undefined,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not send counter-offer.");
      setBusy(false);
      return;
    }
    setShowCounter(false);
    setBusy(false);
    load();
  }

  if (!match || !userId) return <p className="text-muted">Loading…</p>;

  const terms = match.counter_terms ?? match.proposed_terms;
  const isOwnerA = match.site_a.owner_id === userId;
  const waitingOnMe =
    match.initiated_by !== userId && ["proposed", "countered"].includes(match.status);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-medium">
        {match.site_a.domain} ↔ {match.site_b.domain}
      </h1>
      <div className="mb-6 flex gap-2">
        <MetricChip label="Status" value={match.status} tone={match.status === "accepted" ? "verified" : "price"} />
        {match.match_score != null && <MetricChip label="Match" value={`${match.match_score}%`} />}
      </div>

      <div className="mb-6 rounded-chip border border-line bg-white p-4 text-sm">
        <p className="mb-2 font-medium">Proposed terms</p>
        <p className="mb-1">
          <span className="text-muted">{match.site_b.domain} will link to: </span>
          {terms.from_a.target_url} ({terms.from_a.anchor_text})
        </p>
        <p>
          <span className="text-muted">{match.site_a.domain} will link to: </span>
          {terms.from_b.target_url} ({terms.from_b.anchor_text})
        </p>
        {terms.notes && <p className="mt-2 text-muted">Notes: {terms.notes}</p>}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {waitingOnMe && !showCounter && (
        <div className="flex gap-2">
          <Button onClick={() => respond("accept")} disabled={busy}>
            Accept
          </Button>
          <Button variant="secondary" onClick={() => setShowCounter(true)} disabled={busy}>
            Counter-offer
          </Button>
          <Button variant="ghost" onClick={() => respond("reject")} disabled={busy}>
            Decline
          </Button>
        </div>
      )}

      {waitingOnMe && showCounter && (
        <form onSubmit={submitCounter} className="space-y-3 rounded-chip border border-line bg-white p-5">
          <p className="text-xs font-medium text-muted">
            {isOwnerA ? match.site_b.domain : match.site_a.domain} will link to
          </p>
          <Field id="my_target_url" name="my_target_url" label="Page to link to" defaultValue={terms.from_a.target_url} required />
          <Field id="my_anchor_text" name="my_anchor_text" label="Anchor text" defaultValue={terms.from_a.anchor_text} required />
          <p className="pt-2 text-xs font-medium text-muted">
            {isOwnerA ? match.site_a.domain : match.site_b.domain} will link to
          </p>
          <Field id="their_target_url" name="their_target_url" label="Page to link to" defaultValue={terms.from_b.target_url} required />
          <Field id="their_anchor_text" name="their_anchor_text" label="Anchor text" defaultValue={terms.from_b.anchor_text} required />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              Send counter-offer
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowCounter(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {!waitingOnMe && match.status !== "accepted" && match.status !== "rejected" && (
        <p className="text-sm text-muted">Waiting on the other party to respond.</p>
      )}

      {match.status === "accepted" && (
        <p className="text-sm text-signal">
          Accepted — two linked orders were created.{" "}
          <a href="/dashboard/orders" className="underline">
            View orders
          </a>
        </p>
      )}
    </div>
  );
}
