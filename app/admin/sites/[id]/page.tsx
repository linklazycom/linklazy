"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";
import { DrBadge } from "@/components/sites/dr-badge";
import { AccountPicker } from "@/components/admin/account-picker";

interface SiteDetail {
  id: string;
  url: string;
  domain: string;
  niche: string;
  language: string;
  status: string;
  da: number | null;
  pa: number | null;
  dr: number | null;
  dr_verified: number | null;
  dr_verified_at: string | null;
  dr_check_status: string | null;
  organic_traffic: number | null;
  referring_domains: number | null;
  total_backlinks: number | null;
  indexed_pages: number | null;
  post_count: number | null;
  spam_score: number | null;
  price_amount: number | null;
  link_type: string;
  placement: string;
  guidelines: string | null;
  owner_id: string;
  is_featured: boolean;
}

interface AccountOption {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

interface Verification {
  method: string;
  status: string;
  verified_at: string | null;
}

export default function AdminSiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const router = useRouter();
  const supabase = createClient();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [drBusy, setDrBusy] = useState(false);
  const [drMessage, setDrMessage] = useState<string | null>(null);
  const [currentOwner, setCurrentOwner] = useState<AccountOption | null>(null);
  const [newOwner, setNewOwner] = useState<AccountOption | null>(null);
  const [reassignBusy, setReassignBusy] = useState(false);
  const [reassignMessage, setReassignMessage] = useState<string | null>(null);
  const [featuredBusy, setFeaturedBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.from("sites").select("*").eq("id", id).single();
      setSite(s as SiteDetail);

      if (s?.owner_id) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", s.owner_id)
          .single();
        if (ownerProfile) {
          setCurrentOwner({ ...ownerProfile, email: null });
        }
      }

      const { data: v } = await supabase
        .from("site_verifications")
        .select("method, status, verified_at")
        .eq("site_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setVerification(v as Verification);
    }
    load();
  }, [id, supabase]);

  async function approve() {
    setBusy(true);
    await fetch(`/api/sites/${id}/approve`, { method: "POST" });
    router.push("/admin/sites");
  }

  async function refreshDr() {
    setDrBusy(true);
    setDrMessage(null);
    const res = await fetch(`/api/admin/sites/${id}/refresh-dr`, { method: "POST" });
    const body = await res.json();
    setDrBusy(false);
    if (!res.ok) {
      setDrMessage(body.error ?? "DR check failed.");
      return;
    }
    setSite((prev) =>
      prev ? { ...prev, dr_verified: body.dr_verified, dr_verified_at: new Date().toISOString() } : prev
    );
    setDrMessage(`Refreshed — DR ${body.dr_verified}.`);
  }

  async function reject() {
    setBusy(true);
    await fetch(`/api/sites/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    router.push("/admin/sites");
  }

  async function reassignOwner() {
    if (!newOwner) return;
    setReassignBusy(true);
    setReassignMessage(null);
    const res = await fetch("/api/admin/sites/assign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: id, owner_id: newOwner.id }),
    });
    setReassignBusy(false);
    if (!res.ok) {
      const body = await res.json();
      setReassignMessage(body.error ?? "Could not reassign this site.");
      return;
    }
    setCurrentOwner(newOwner);
    setNewOwner(null);
    setReassignMessage(`Reassigned to ${newOwner.full_name || newOwner.email}.`);
  }

  async function toggleFeatured() {
    if (!site) return;
    setFeaturedBusy(true);
    const next = !site.is_featured;
    const res = await fetch(`/api/admin/sites/${id}/featured`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_featured: next }),
    });
    setFeaturedBusy(false);
    if (res.ok) setSite((prev) => (prev ? { ...prev, is_featured: next } : prev));
  }

  if (!site) return <p className="text-muted">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-medium">{site.domain}</h1>
      <a href={site.url} target="_blank" rel="noreferrer" className="mb-6 block text-sm text-muted underline">
        {site.url}
      </a>

      <div className="mb-6 flex flex-wrap gap-2">
        <MetricChip label="Niche" value={site.niche} />
        <MetricChip label="Language" value={site.language} />
        {site.da != null && <MetricChip label="DA" value={site.da} />}
        {site.pa != null && <MetricChip label="PA" value={site.pa} />}
        <DrBadge selfReportedDr={site.dr} verifiedDr={site.dr_verified} />
        {site.organic_traffic != null && (
          <MetricChip label="Traffic" value={`${site.organic_traffic}/mo`} />
        )}
        {site.referring_domains != null && (
          <MetricChip label="Ref. domains" value={site.referring_domains} />
        )}
        {site.total_backlinks != null && (
          <MetricChip label="Backlinks" value={site.total_backlinks} />
        )}
        {site.indexed_pages != null && (
          <MetricChip label="Indexed" value={site.indexed_pages} />
        )}
        {site.post_count != null && <MetricChip label="Posts" value={site.post_count} />}
        {site.spam_score != null && <MetricChip label="Spam score" value={site.spam_score} />}
        {site.price_amount != null && (
          <MetricChip label="Price" value={site.price_amount} tone="price" />
        )}
        <MetricChip label="Link type" value={site.link_type} />
        <MetricChip label="Placement" value={site.placement} />
      </div>

      <div className="mb-6 rounded-chip border border-line bg-white p-4">
        <p className="mb-1 text-sm font-medium">Domain Rating (Ahrefs)</p>
        <p className="mb-2 text-xs text-muted">
          {site.dr_verified != null
            ? `Last verified ${site.dr_verified_at ? new Date(site.dr_verified_at).toLocaleString() : "recently"}${site.dr_check_status === "failed" ? " — most recent re-check failed, showing last good value" : ""}.`
            : "Not yet checked. The weekly cron will pick it up, or check now."}
        </p>
        <Button size="sm" variant="secondary" onClick={refreshDr} disabled={drBusy}>
          {drBusy ? "Checking…" : "Re-check DR now"}
        </Button>
        {drMessage && <p className="mt-2 text-xs text-muted">{drMessage}</p>}
      </div>

      <div className="mb-6 rounded-chip border border-line bg-white p-4">
        <p className="mb-1 text-sm font-medium">Ownership verification</p>
        {verification ? (
          <MetricChip
            label={verification.method}
            value={verification.status}
            tone={verification.status === "verified" ? "verified" : "default"}
          />
        ) : (
          <p className="text-sm text-muted">No verification challenge yet.</p>
        )}
        {verification?.status !== "verified" && (
          <p className="mt-2 text-xs text-red-600">
            Ownership not yet verified — approving before verification is not
            recommended.
          </p>
        )}
      </div>

      <div className="mb-6 rounded-chip border border-line bg-white p-4">
        <p className="mb-1 text-sm font-medium">Homepage / Browse highlight</p>
        <p className="mb-3 text-xs text-muted">
          Featured sites show a gradient top-bar and a "★ Featured" badge, and sort first in
          Browse Sites. Use this to spotlight sites you want buyers to notice.
        </p>
        <Button size="sm" variant={site.is_featured ? "primary" : "secondary"} onClick={toggleFeatured} disabled={featuredBusy}>
          {featuredBusy ? "Updating…" : site.is_featured ? "★ Featured — click to unfeature" : "Mark as Featured"}
        </Button>
      </div>

      <div className="mb-6 rounded-chip border border-line bg-white p-4">
        <p className="mb-1 text-sm font-medium">Owner account</p>
        <p className="mb-3 text-xs text-muted">
          Currently: {currentOwner ? `${currentOwner.full_name || "(no name)"} · ${currentOwner.role}` : "Loading…"}
        </p>
        <AccountPicker label="Reassign to a different account" selected={newOwner} onSelect={setNewOwner} />
        {newOwner && (
          <Button size="sm" className="mt-3" onClick={reassignOwner} disabled={reassignBusy}>
            {reassignBusy ? "Reassigning…" : "Confirm reassign"}
          </Button>
        )}
        {reassignMessage && <p className="mt-2 text-xs text-muted">{reassignMessage}</p>}
      </div>

      {site.guidelines && (
        <div className="mb-6 rounded-chip border border-line bg-white p-4">
          <p className="mb-1 text-sm font-medium">Seller guidelines</p>
          <p className="text-sm text-muted">{site.guidelines}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={approve} disabled={busy}>
          Approve
        </Button>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Rejection reason (optional)"
          className="flex-1 rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
        <Button variant="secondary" onClick={reject} disabled={busy}>
          Reject
        </Button>
      </div>
    </div>
  );
}
