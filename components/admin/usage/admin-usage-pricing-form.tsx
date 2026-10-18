"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";
import { MAX_FREE_PER_DAY, MAX_USAGE_PRICE } from "@/lib/usage/actions";

export interface UsageActionField {
  id: string;
  label: string;
  unit: string;
  price: number;
  freePerDay: number;
}

export function AdminUsagePricingForm({ enabled: initialEnabled, actions }: { enabled: boolean; actions: UsageActionField[] }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(actions.map((a) => [a.id, String(a.price)])));
  const [free, setFree] = useState<Record<string, string>>(Object.fromEntries(actions.map((a) => [a.id, String(a.freePerDay)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (enabled && !initialEnabled && !window.confirm("Turn charging ON? Users will be charged from their wallets for every action above that has a price.")) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await apiRequest("/api/admin/usage-pricing", "POST", {
      enabled,
      prices: Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, Number(v)])),
      freePerDay: Object.fromEntries(Object.entries(free).map(([k, v]) => [k, Number(v)])),
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5 rounded-chip border border-line bg-white p-5">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }} />
        <span>
          <b>Charging is {enabled ? "ON" : "OFF"}</b>
          <span className="block text-xs text-muted">
            While OFF (or while an action&apos;s price is 0) everything is free and no wallet is touched. Admins are never charged.
          </span>
        </span>
      </label>

      <div className="space-y-4">
        {actions.map((a) => (
          <div key={a.id} className="rounded-chip border border-line p-4">
            <p className="font-medium">{a.label}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field
                id={`price_${a.id}`}
                type="number"
                min={0}
                max={MAX_USAGE_PRICE}
                label={`Price ${a.unit} (৳, 0 = free)`}
                value={prices[a.id]}
                onChange={(e) => { setPrices((v) => ({ ...v, [a.id]: e.target.value })); setSaved(false); }}
              />
              <Field
                id={`free_${a.id}`}
                type="number"
                min={0}
                max={MAX_FREE_PER_DAY}
                label="Free uses per user per day (UTC)"
                value={free[a.id]}
                onChange={(e) => { setFree((v) => ({ ...v, [a.id]: e.target.value })); setSaved(false); }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Whole numbers only. Changes apply within about 20 seconds. The price a user is charged is always decided on the server; a price shown in the browser is never trusted.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-signal">Saved ✓</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save pricing"}
      </Button>
    </form>
  );
}
