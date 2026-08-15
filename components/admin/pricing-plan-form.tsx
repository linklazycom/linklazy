"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

interface Feature {
  label: string;
  included: boolean;
}

export interface PricingPlanFormValues {
  id?: string;
  plan_group: "buyer" | "seller";
  name: string;
  price_amount: number | null;
  price_label: string;
  period: string;
  tagline: string;
  cta_label: string;
  highlight: boolean;
  active: boolean;
  display_order: number;
  features: Feature[];
}

const DEFAULTS: PricingPlanFormValues = {
  plan_group: "buyer",
  name: "",
  price_amount: null,
  price_label: "",
  period: "billed monthly",
  tagline: "",
  cta_label: "Choose plan",
  highlight: false,
  active: true,
  display_order: 1,
  features: [{ label: "", included: true }],
};

export function PricingPlanForm({ initial }: { initial?: PricingPlanFormValues }) {
  const router = useRouter();
  const supabase = createClient();
  const [values, setValues] = useState<PricingPlanFormValues>(initial ?? DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof PricingPlanFormValues>(key: K, value: PricingPlanFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateFeature(index: number, patch: Partial<Feature>) {
    setValues((prev) => ({
      ...prev,
      features: prev.features.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));
  }

  function addFeature() {
    setValues((prev) => ({ ...prev, features: [...prev.features, { label: "", included: true }] }));
  }

  function removeFeature(index: number) {
    setValues((prev) => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      plan_group: values.plan_group,
      name: values.name.trim(),
      price_amount: values.price_amount === null || Number.isNaN(values.price_amount) ? null : values.price_amount,
      price_label: values.price_label.trim() || null,
      period: values.period.trim(),
      tagline: values.tagline.trim(),
      cta_label: values.plan_group === "buyer" ? values.cta_label.trim() || null : null,
      highlight: values.highlight,
      active: values.active,
      display_order: values.display_order,
      features: values.features.filter((f) => f.label.trim().length > 0),
    };

    if (!payload.name) {
      setError("Plan name is required.");
      setSaving(false);
      return;
    }
    if (payload.price_amount === null && !payload.price_label) {
      setError("Set either a numeric price or a price label (e.g. \"15-20%\").");
      setSaving(false);
      return;
    }

    // RLS ("pricing_plans_admin_all") enforces this only succeeds for an
    // admin session, same pattern as the coupon form.
    const { error: dbError } = values.id
      ? await supabase.from("pricing_plans").update(payload).eq("id", values.id)
      : await supabase.from("pricing_plans").insert(payload);

    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }

    router.push("/admin/pricing");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <div>
        <label htmlFor="plan_group" className="mb-1 block text-sm text-muted">
          Applies to
        </label>
        <select
          id="plan_group"
          value={values.plan_group}
          onChange={(e) => update("plan_group", e.target.value as "buyer" | "seller")}
          className="w-full rounded-chip border border-line px-3 py-2 text-sm"
        >
          <option value="buyer">Buyer plans</option>
          <option value="seller">Seller plans</option>
        </select>
      </div>

      <Field
        id="name"
        name="name"
        label="Plan name"
        defaultValue={values.name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("name", e.target.value)}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price_amount" className="mb-1 block text-sm text-muted">
            Price (৳, numeric — leave blank if using a label like &quot;15-20%&quot;)
          </label>
          <input
            id="price_amount"
            type="number"
            min={0}
            value={values.price_amount ?? ""}
            onChange={(e) => update("price_amount", e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>
        <div>
          <label htmlFor="price_label" className="mb-1 block text-sm text-muted">
            Price label (overrides numeric price if set)
          </label>
          <input
            id="price_label"
            value={values.price_label}
            onChange={(e) => update("price_label", e.target.value)}
            placeholder="15–20%"
            className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>
      </div>

      <Field
        id="period"
        name="period"
        label="Period text (e.g. 'billed monthly', 'forever', 'per completed paid order')"
        defaultValue={values.period}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("period", e.target.value)}
      />

      <div>
        <label htmlFor="tagline" className="mb-1 block text-sm text-muted">
          Tagline
        </label>
        <textarea
          id="tagline"
          rows={2}
          value={values.tagline}
          onChange={(e) => update("tagline", e.target.value)}
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>

      {values.plan_group === "buyer" && (
        <Field
          id="cta_label"
          name="cta_label"
          label="Button text"
          defaultValue={values.cta_label}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("cta_label", e.target.value)}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.highlight}
            onChange={(e) => update("highlight", e.target.checked)}
          />
          Highlight as &quot;Most popular&quot;
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(e) => update("active", e.target.checked)}
          />
          Visible on the public page
        </label>
      </div>

      <div>
        <label htmlFor="display_order" className="mb-1 block text-sm text-muted">
          Display order (lower shows first)
        </label>
        <input
          id="display_order"
          type="number"
          value={values.display_order}
          onChange={(e) => update("display_order", Number(e.target.value))}
          className="w-32 rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>

      <div>
        <p className="mb-2 text-sm text-muted">Feature list</p>
        <div className="space-y-2">
          {values.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              {values.plan_group === "buyer" && (
                <input
                  type="checkbox"
                  checked={f.included}
                  onChange={(e) => updateFeature(i, { included: e.target.checked })}
                  title="Included in this plan"
                />
              )}
              <input
                value={f.label}
                onChange={(e) => updateFeature(i, { label: e.target.value })}
                placeholder="Feature description"
                className="flex-1 rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-signal"
              />
              <button
                type="button"
                onClick={() => removeFeature(i)}
                className="text-sm text-muted hover:text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addFeature}
          className="mt-2 text-sm text-brand-blue underline"
        >
          + Add feature
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save plan"}
      </Button>
    </form>
  );
}
