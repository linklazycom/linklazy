"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export interface LimitField {
  key: string;
  label: string;
  value: number;
  min: number;
  max: number;
}

export function AdminLinkSettingsForm({ fields }: { fields: LimitField[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.key, String(f.value)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await apiRequest("/api/admin/links/settings", "POST", {
      values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])),
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-chip border border-line bg-white p-5">
      <h2 className="font-display text-lg font-medium">Limits</h2>
      <p className="text-xs text-muted">Admins are never limited. Changes apply within about a minute.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <Field
            key={f.key}
            id={f.key}
            type="number"
            min={f.min}
            max={f.max}
            label={f.label}
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-signal">Saved ✓</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save limits"}
      </Button>
    </form>
  );
}
