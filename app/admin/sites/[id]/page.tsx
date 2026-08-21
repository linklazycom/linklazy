"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";
import { DrBadge } from "@/components/sites/dr-badge";
import { AccountPicker } from "@/components/admin/account-picker";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { NICHES } from "@/lib/niches";

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
  accepts_exchange: boolean;
  accepts_paid: boolean;
  price_amount: number | null;
  link_type: string;
  placement: string;
  turnaround_hours: number | null;
  guidelines: string | null;
  owner_id: string;
  is_featured: boolean;
}

// Fields the "Edit listing" form can change, sent to PATCH
// /api/admin/sites/[id]. Kept separate from SiteDetail since not every
// site field is editable here (status/DR/owner/featured have their own
// dedicated controls elsewhere on this page).
interface EditableFields {
  niche: string;
  language: string;
  da: string;
  pa: string;
  dr: string;
  organic_traffic: string;
  referring_domains: string;
  total_backlinks: string;
  indexed_pages: string;
  post_count: string;
  spam_score: string;
  accepts_exchange: boolean;
  accepts_paid: boolean;
  price_amount: string;
  link_type: string;
  placement: string;
  turnaround_hours: string;
  guidelines: string;
}

function toEditableFields(site: SiteDetail): EditableFields {
  return {
    niche: site.niche ?? "",
    language: site.language ?? "en",
    da: site.da?.toString() ?? "",
    pa: site.pa?.toString() ?? "",
    dr: site.dr?.toString() ?? "",
    organic_traffic: site.organic_traffic?.toString() ?? "",
    referring_domains: site.referring_domains?.toString() ?? "",
    total_backlinks: site.total_backlinks?.toString() ?? "",
    indexed_pages: site.indexed_pages?.toString() ?? "",
    post_count: site.post_count?.toString() ?? "",
    spam_score: site.spam_score?.toString() ?? "",
    accepts_exchange: site.accepts_exchange ?? true,
    accepts_paid: site.accepts_paid ?? true,
    price_amount: site.price_amount?.toString() ?? "",
    link_type: site.link_type ?? "dofollow",
    placement: site.placement ?? "in_content",
    turnaround_hours: site.turnaround_hours?.toString() ?? "48",
    guidelines: site.guidelines ?? "",
  };
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
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditableFields | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.from("sites").select("*").eq("id", id).single();
      setSite(s as SiteDetail);
      if (s) setForm(toEditableFields(s as SiteDetail));

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

  function updateForm<K extends keyof EditableFields>(key: K, value: EditableFields[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function saveEdits() {
    if (!form) return;
    setSaveBusy(true);
    setSaveMessage(null);
    setSaveError(null);

    // Send numeric fields only when non-empty, so blank inputs don't get
    // coerced to 0 — they clear the value instead by being omitted here
    // and left as null server-side is out of scope; omitting just leaves
    // the existing value untouched, which is the safer default for a
    // partial edit.
    const toNumberOrUndefined = (v: string) => (v.trim() === "" ? undefined : v.trim());

    const payload = {
      niche: form.niche,
      language: form.language,
      da: toNumberOrUndefined(form.da),
      pa: toNumberOrUndefined(form.pa),
      dr: toNumberOrUndefined(form.dr),
      organic_traffic: toNumberOrUndefined(form.organic_traffic),
      referring_domains: toNumberOrUndefined(form.referring_domains),
      total_backlinks: toNumberOrUndefined(form.total_backlinks),
      indexed_pages: toNumberOrUndefined(form.indexed_pages),
      post_count: toNumberOrUndefined(form.post_count),
      spam_score: toNumberOrUndefined(form.spam_score),
      accepts_exchange: form.accepts_exchange,
      accepts_paid: form.accepts_paid,
      price_amount: toNumberOrUndefined(form.price_amount),
      link_type: form.link_type,
      placement: form.placement,
      turnaround_hours: toNumberOrUndefined(form.turnaround_hours),
      guidelines: form.guidelines.trim() === "" ? undefined : form.guidelines,
    };

    const res = await fetch(`/api/admin/sites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setSaveBusy(false);

    if (!res.ok) {
      const fieldErrors = (body.error ?? {}) as Record<string, string[]> | string;
      const firstError =
        typeof fieldErrors === "string" ? fieldErrors : Object.values(fieldErrors)[0]?.[0];
      setSaveError(firstError ?? "Could not save these changes.");
      return;
    }

    setSite(body.site as SiteDetail);
    setForm(toEditableFields(body.site as SiteDetail));
    setSaveMessage("Changes saved.");
    setEditing(false);
  }

  if (!site || !form) return <p className="text-muted">Loading…</p>;

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
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-medium">Edit listing</p>
          {!editing && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>

        {!editing ? (
          <p className="text-xs text-muted">
            Correct niche, metrics, price, link terms, or guidelines if a seller&apos;s self-reported
            numbers were wrong or a listing needs updating.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                id="edit-niche"
                label="Niche"
                options={NICHES}
                value={form.niche}
                onChange={(e) => updateForm("niche", e.target.value)}
              />
              <Field
                id="edit-language"
                label="Language"
                value={form.language}
                onChange={(e) => updateForm("language", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field id="edit-da" type="number" label="DA" value={form.da} onChange={(e) => updateForm("da", e.target.value)} />
              <Field id="edit-pa" type="number" label="PA" value={form.pa} onChange={(e) => updateForm("pa", e.target.value)} />
              <Field
                id="edit-dr"
                type="number"
                label="DR (self-reported)"
                value={form.dr}
                onChange={(e) => updateForm("dr", e.target.value)}
              />
              <Field
                id="edit-traffic"
                type="number"
                label="Monthly traffic"
                value={form.organic_traffic}
                onChange={(e) => updateForm("organic_traffic", e.target.value)}
              />
              <Field
                id="edit-refdomains"
                type="number"
                label="Referring domains"
                value={form.referring_domains}
                onChange={(e) => updateForm("referring_domains", e.target.value)}
              />
              <Field
                id="edit-backlinks"
                type="number"
                label="Total backlinks"
                value={form.total_backlinks}
                onChange={(e) => updateForm("total_backlinks", e.target.value)}
              />
              <Field
                id="edit-indexed"
                type="number"
                label="Indexed pages"
                value={form.indexed_pages}
                onChange={(e) => updateForm("indexed_pages", e.target.value)}
              />
              <Field
                id="edit-posts"
                type="number"
                label="Post count"
                value={form.post_count}
                onChange={(e) => updateForm("post_count", e.target.value)}
              />
              <Field
                id="edit-spam"
                type="number"
                label="Spam score"
                value={form.spam_score}
                onChange={(e) => updateForm("spam_score", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 rounded-chip border border-line px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.accepts_exchange}
                  onChange={(e) => updateForm("accepts_exchange", e.target.checked)}
                />
                Accept exchange
              </label>
              <label className="flex items-center gap-2 rounded-chip border border-line px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.accepts_paid}
                  onChange={(e) => updateForm("accepts_paid", e.target.checked)}
                />
                Accept paid orders
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field
                id="edit-price"
                type="number"
                label="Price (৳, smallest unit)"
                value={form.price_amount}
                onChange={(e) => updateForm("price_amount", e.target.value)}
                disabled={!form.accepts_paid}
              />
              <div>
                <label htmlFor="edit-link-type" className="mb-1 block text-sm text-muted">
                  Link type
                </label>
                <select
                  id="edit-link-type"
                  value={form.link_type}
                  onChange={(e) => updateForm("link_type", e.target.value)}
                  className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
                >
                  <option value="dofollow">Dofollow</option>
                  <option value="nofollow">Nofollow</option>
                </select>
              </div>
              <div>
                <label htmlFor="edit-placement" className="mb-1 block text-sm text-muted">
                  Placement
                </label>
                <select
                  id="edit-placement"
                  value={form.placement}
                  onChange={(e) => updateForm("placement", e.target.value)}
                  className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
                >
                  <option value="in_content">In-content</option>
                  <option value="author_bio">Author bio</option>
                  <option value="homepage">Homepage</option>
                  <option value="sidebar">Sidebar</option>
                </select>
              </div>
            </div>

            <Field
              id="edit-turnaround"
              type="number"
              label="Turnaround time (hours)"
              value={form.turnaround_hours}
              onChange={(e) => updateForm("turnaround_hours", e.target.value)}
            />

            <div>
              <label htmlFor="edit-guidelines" className="mb-1 block text-sm text-muted">
                Content guidelines (optional)
              </label>
              <textarea
                id="edit-guidelines"
                rows={3}
                value={form.guidelines}
                onChange={(e) => updateForm("guidelines", e.target.value)}
                className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
              />
            </div>

            {saveError && <p className="text-sm text-red-600">{saveError}</p>}

            <div className="flex items-center gap-3">
              <Button size="sm" onClick={saveEdits} disabled={saveBusy}>
                {saveBusy ? "Saving…" : "Save changes"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setForm(toEditableFields(site));
                  setEditing(false);
                  setSaveError(null);
                }}
                disabled={saveBusy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        {!editing && saveMessage && <p className="mt-2 text-xs text-muted">{saveMessage}</p>}
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
