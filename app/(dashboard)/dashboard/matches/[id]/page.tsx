"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MetricChip } from "@/components/ui/metric-chip";

interface Link2 {
  target_url: string;
  anchor_text: string;
}
interface Terms {
  from_a: Link2;
  from_b?: Link2 | null;
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
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showCounter, setShowCounter] = useState(false);
  const [showAccept, setShowAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    // Served by /api/matches/[id]: checks you own one of the two sites and
    // masks the other party's domain until the exchange is accepted.
    const res = await fetch(`/api/matches/${id}`, { cache: "no-store" });
    if (!res.ok) {
      setError("Could not load this proposal.");
      return;
    }
    const data = await res.json();
    setUserId(data.userId);
    setMatch(data.match as MatchDetail);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function respond(action: "accept" | "reject", acceptTerms?: Link2) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/matches/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...(acceptTerms ? { accept_terms: acceptTerms } : {}) }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Could not respond. Check the page address.");
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
        counter: {
          own_target_url: form.get("own_target_url"),
          own_anchor_text: form.get("own_anchor_text"),
          other_anchor_text: form.get("other_anchor_text"),
          notes: form.get("notes") || undefined,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Could not send the counter-offer. Check the page address.");
      setBusy(false);
      return;
    }
    setShowCounter(false);
    setBusy(false);
    load();
  }

  if (error && (!match || !userId)) return <p className="text-sm text-red-600">{error}</p>;
  if (!match || !userId) return <p className="text-muted">Loading…</p>;

  const terms = (match.counter_terms ?? match.proposed_terms) as Terms;
  const isOwnerA = match.site_a.owner_id === userId;
  const mine = isOwnerA ? terms.from_a : terms.from_b; // the page on MY site that the other owner links to
  const theirs = isOwnerA ? terms.from_b : terms.from_a; // the page on THEIR site that I link to (masked until accepted)
  const myDomain = isOwnerA ? match.site_a.domain : match.site_b.domain;
  const waitingOnMe =
    match.initiated_by !== userId && ["proposed", "countered"].includes(match.status);
  const needsMyPage = waitingOnMe && !mine;

  async function submitAccept(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await respond("accept", { target_url: String(form.get("accept_target_url") ?? ""), anchor_text: String(form.get("accept_anchor_text") ?? "") });
  }

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
        <p className="mb-2 font-medium">{match.status === "countered" ? "Counter-offer" : "Proposed terms"}</p>
        <p className="mb-1">
          <span className="text-muted">{match.site_b.domain} will link to: </span>
          {terms.from_a.target_url} ({terms.from_a.anchor_text})
        </p>
        <p>
          <span className="text-muted">{match.site_a.domain} will link to: </span>
          {terms.from_b
            ? `${terms.from_b.target_url} (${terms.from_b.anchor_text})`
            : !isOwnerA
              ? "a page on your site that you choose when you accept"
              : "a page on their site that its owner chooses when they accept"}
        </p>
        {terms.notes && <p className="mt-2 text-muted">Notes: {terms.notes}</p>}
        {match.status !== "accepted" && (
          <p className="mt-3 text-xs text-muted">The other owner&apos;s site and page address stay hidden until the exchange is accepted.</p>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {waitingOnMe && !showCounter && !showAccept && (
        <div className="flex gap-2">
          <Button onClick={() => (needsMyPage ? setShowAccept(true) : respond("accept"))} disabled={busy}>
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

      {needsMyPage && showAccept && (
        <form onSubmit={submitAccept} className="space-y-3 rounded-chip border border-line bg-white p-5">
          <p className="text-sm text-muted">
            Choose the page on <strong className="text-ink">{myDomain}</strong> that should receive the link from the other site, and the anchor text for it.
          </p>
          <Field id="accept_target_url" name="accept_target_url" label="Page on your site" placeholder={`https://${myDomain}/page`} required />
          <Field id="accept_anchor_text" name="accept_anchor_text" label="Anchor text" required />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              Accept exchange
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAccept(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {waitingOnMe && showCounter && (
        <form onSubmit={submitCounter} className="space-y-3 rounded-chip border border-line bg-white p-5">
          <p className="text-xs font-medium text-muted">The link placed on their site</p>
          <Field id="own_target_url" name="own_target_url" label="Page on YOUR site they should link to" placeholder={`https://${myDomain}/page`} defaultValue={mine?.target_url ?? ""} required />
          <Field id="own_anchor_text" name="own_anchor_text" label="Anchor text they use" defaultValue={mine?.anchor_text ?? ""} required />
          <p className="pt-2 text-xs font-medium text-muted">The link you place on your site</p>
          <p className="text-xs text-muted">
            It points to: <span className="text-ink">{theirs?.target_url ?? "their page"}</span> (their page can&apos;t be changed by you)
          </p>
          <Field id="other_anchor_text" name="other_anchor_text" label="Anchor text you use" defaultValue={theirs?.anchor_text ?? ""} required />
          <div>
            <label htmlFor="notes" className="mb-1 block text-sm text-muted">Notes (optional)</label>
            <textarea id="notes" name="notes" rows={2} defaultValue={terms.notes ?? ""} className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-brand-violet" />
          </div>
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
          <Link href="/dashboard/orders" className="underline">
            View orders
          </Link>
        </p>
      )}
    </div>
  );
}
