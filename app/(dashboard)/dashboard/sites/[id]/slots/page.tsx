"use client";

import { useEffect, useState, use as usePromise } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MetricChip } from "@/components/ui/metric-chip";

interface Slot {
  id: string;
  label: string | null;
  link_type: string;
  placement: string;
  price_amount: number | null;
  accepts_exchange: boolean;
  accepts_paid: boolean;
  is_active: boolean;
}

export default function SiteSlotsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const supabase = createClient();
  const [domain, setDomain] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const { data: site } = await supabase.from("sites").select("domain").eq("id", id).single();
    if (site) setDomain(site.domain);

    const { data } = await supabase
      .from("site_link_slots")
      .select("*")
      .eq("site_id", id)
      .order("created_at", { ascending: true });
    setSlots((data as Slot[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      label: form.get("label"),
      link_type: form.get("link_type"),
      placement: form.get("placement"),
      max_concurrent_orders: form.get("max_concurrent_orders") || 1,
      price_amount: form.get("price_amount") || undefined,
      accepts_exchange: form.get("accepts_exchange") === "on",
      accepts_paid: form.get("accepts_paid") === "on",
      content_provided_by: form.get("content_provided_by"),
    };
    await fetch(`/api/sites/${id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    setShowForm(false);
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function toggleActive(slot: Slot) {
    await fetch(`/api/sites/${id}/slots/${slot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !slot.is_active }),
    });
    load();
  }

  async function removeSlot(slotId: string) {
    await fetch(`/api/sites/${id}/slots/${slotId}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-medium">Link slots — {domain}</h1>
      <p className="mb-6 text-sm text-muted">
        Each slot is a separate link placement buyers can order — e.g. one
        homepage sidebar link and multiple in-content blog links, priced
        independently.
      </p>

      <div className="mb-4 space-y-3">
        {slots.map((slot) => (
          <div key={slot.id} className="rounded-chip border border-line bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">{slot.label || "Untitled slot"}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => toggleActive(slot)}>
                  {slot.is_active ? "Deactivate" : "Activate"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeSlot(slot.id)}>
                  Delete
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <MetricChip label="Type" value={slot.link_type} />
              <MetricChip label="Placement" value={slot.placement} />
              {slot.price_amount != null && (
                <MetricChip label="Price" value={slot.price_amount} tone="price" />
              )}
              <MetricChip
                label="Status"
                value={slot.is_active ? "active" : "inactive"}
                tone={slot.is_active ? "verified" : "default"}
              />
            </div>
          </div>
        ))}
        {!slots.length && <p className="text-sm text-muted">No link slots yet.</p>}
      </div>

      {!showForm ? (
        <Button onClick={() => setShowForm(true)}>Add a link slot</Button>
      ) : (
        <form onSubmit={handleCreate} className="space-y-4 rounded-chip border border-line bg-white p-5">
          <Field id="label" name="label" label="Label" placeholder="Blog post link" required />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="link_type" className="mb-1 block text-sm text-muted">
                Link type
              </label>
              <select id="link_type" name="link_type" defaultValue="dofollow" className="w-full rounded-chip border border-line px-3 py-2 text-sm">
                <option value="dofollow">Dofollow</option>
                <option value="nofollow">Nofollow</option>
              </select>
            </div>
            <div>
              <label htmlFor="placement" className="mb-1 block text-sm text-muted">
                Placement
              </label>
              <select id="placement" name="placement" defaultValue="in_content" className="w-full rounded-chip border border-line px-3 py-2 text-sm">
                <option value="in_content">In-content</option>
                <option value="author_bio">Author bio</option>
                <option value="homepage">Homepage</option>
                <option value="sidebar">Sidebar</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field id="price_amount" name="price_amount" type="number" label="Price (৳)" />
            <div>
              <label htmlFor="content_provided_by" className="mb-1 block text-sm text-muted">
                Content provided by
              </label>
              <select id="content_provided_by" name="content_provided_by" defaultValue="seller" className="w-full rounded-chip border border-line px-3 py-2 text-sm">
                <option value="seller">Seller writes it</option>
                <option value="buyer">Buyer provides it</option>
              </select>
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="accepts_exchange" defaultChecked /> Accept exchange
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="accepts_paid" defaultChecked /> Accept paid
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save slot"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
