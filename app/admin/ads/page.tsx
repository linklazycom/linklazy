"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

interface AdSlot {
  id: string;
  placement: string;
  kind: "image_link" | "html";
  image_url: string | null;
  link_url: string | null;
  html_code: string | null;
  alt_text: string | null;
  active: boolean;
  sort_order: number;
}

const KNOWN_PLACEMENTS = [
  { key: "browse_top", label: "Browse page — top banner" },
  { key: "browse_sidebar", label: "Browse page — sidebar" },
  { key: "site_detail_bottom", label: "Site detail page — bottom" },
  { key: "dashboard_sidebar", label: "Dashboard sidebar" },
  { key: "homepage_below_hero", label: "Homepage — below hero" },
];

const AUDIENCE_OPTIONS = [
  { value: "off", label: "Ads off everywhere" },
  { value: "all", label: "Show to everyone" },
];

export default function AdminAdsPage() {
  const [slots, setSlots] = useState<AdSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [audience, setAudience] = useState("off");
  const [savingAudience, setSavingAudience] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    placement: KNOWN_PLACEMENTS[0].key,
    kind: "image_link" as "image_link" | "html",
    image_url: "",
    link_url: "",
    html_code: "",
    alt_text: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function loadSlots() {
    setLoading(true);
    const res = await fetch("/api/admin/ads");
    const body = await res.json();
    setSlots(body.slots ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadSlots();
    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.from("site_settings").select("value").eq("key", "ads_enabled").single();
      if (data?.value) setAudience(data.value as string);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAudience(next: string) {
    setAudience(next);
    setSavingAudience(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "ads_enabled", value: next }),
    });
    setSavingAudience(false);
  }

  async function createSlot(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const payload: Record<string, unknown> = {
      placement: form.placement,
      kind: form.kind,
      active: true,
      sort_order: 0,
    };
    if (form.kind === "image_link") {
      payload.image_url = form.image_url;
      payload.link_url = form.link_url || undefined;
      payload.alt_text = form.alt_text || undefined;
    } else {
      payload.html_code = form.html_code;
    }

    const res = await fetch("/api/admin/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setCreating(false);

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Could not create ad slot.");
      return;
    }

    setForm({ placement: KNOWN_PLACEMENTS[0].key, kind: "image_link", image_url: "", link_url: "", html_code: "", alt_text: "" });
    loadSlots();
  }

  async function toggleActive(slot: AdSlot) {
    await fetch(`/api/admin/ads/${slot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !slot.active }),
    });
    loadSlots();
  }

  async function deleteSlot(id: string) {
    if (!confirm("Delete this ad slot?")) return;
    await fetch(`/api/admin/ads/${id}`, { method: "DELETE" });
    loadSlots();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 font-display text-2xl font-medium">Ads</h1>
      <p className="mb-6 text-sm text-muted">
        Manage image/link or HTML ad creatives shown across the site, and control who sees
        them.
      </p>

      <div className="mb-8 rounded-chip border border-line bg-white p-4">
        <p className="mb-2 text-sm font-medium">Global audience</p>
        <div className="space-y-2">
          {AUDIENCE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="audience"
                checked={audience === opt.value}
                onChange={() => saveAudience(opt.value)}
                disabled={savingAudience}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-8 rounded-chip border border-line bg-white p-4">
        <p className="mb-3 text-sm font-medium">Add ad slot</p>
        <form onSubmit={createSlot} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-muted">Placement</label>
            <select
              value={form.placement}
              onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value }))}
              className="w-full rounded-chip border border-line px-3 py-2 text-sm"
            >
              {KNOWN_PLACEMENTS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label} ({p.key})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, kind: "image_link" }))}
              className={`flex-1 rounded-chip border px-3 py-2 text-sm ${
                form.kind === "image_link" ? "border-ink bg-ink text-white" : "border-line"
              }`}
            >
              Image + link
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, kind: "html" }))}
              className={`flex-1 rounded-chip border px-3 py-2 text-sm ${
                form.kind === "html" ? "border-ink bg-ink text-white" : "border-line"
              }`}
            >
              Raw HTML / script
            </button>
          </div>

          {form.kind === "image_link" ? (
            <>
              <Field
                id="image_url"
                label="Image URL"
                required
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              />
              <Field
                id="link_url"
                label="Click-through link (optional)"
                value={form.link_url}
                onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
              />
              <Field
                id="alt_text"
                label="Alt text (optional)"
                value={form.alt_text}
                onChange={(e) => setForm((f) => ({ ...f, alt_text: e.target.value }))}
              />
            </>
          ) : (
            <div>
              <label htmlFor="html_code" className="mb-1 block text-sm text-muted">
                HTML / ad network embed code
              </label>
              <textarea
                id="html_code"
                required
                rows={6}
                value={form.html_code}
                onChange={(e) => setForm((f) => ({ ...f, html_code: e.target.value }))}
                placeholder="<script>...</script> or <a href=...><img .../></a>"
                className="w-full rounded-chip border border-line px-3 py-2 font-mono text-xs outline-none focus:border-signal"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={creating}>
            {creating ? "Adding…" : "Add ad slot"}
          </Button>
        </form>
      </div>

      <p className="mb-3 text-sm font-medium">Existing ad slots</p>
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="space-y-2">
          {slots.map((slot) => (
            <div key={slot.id} className="rounded-chip border border-line bg-white p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">{slot.placement}</span>
                <span className="text-xs text-muted">{slot.kind}</span>
              </div>
              <p className="mb-2 truncate text-xs text-muted">
                {slot.kind === "image_link" ? slot.image_url : slot.html_code?.slice(0, 80)}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => toggleActive(slot)}>
                  {slot.active ? "Deactivate" : "Activate"}
                </Button>
                <button onClick={() => deleteSlot(slot.id)} className="text-xs text-red-600 underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!slots.length && <p className="text-sm text-muted">No ad slots yet.</p>}
        </div>
      )}
    </div>
  );
}
