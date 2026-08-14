"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  siteId: string;
  initialEnabled: boolean;
  initialPrice: number | null;
  initialDurationDays: number | null;
}

export function PayPerViewSettings({
  siteId,
  initialEnabled,
  initialPrice,
  initialDurationDays,
}: Props) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [price, setPrice] = useState<number | "">(initialPrice ?? "");
  const [lifetime, setLifetime] = useState(initialDurationDays == null);
  const [durationDays, setDurationDays] = useState<number | "">(initialDurationDays ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/sites/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pay_per_view_enabled: enabled,
        view_price: enabled ? (price === "" ? null : Number(price)) : null,
        access_duration_days: lifetime ? null : durationDays === "" ? null : Number(durationDays),
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(body.error ?? "Could not save settings.");
      return;
    }
    setMessage("Saved.");
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-brand-blue underline"
      >
        {open ? "Hide pay-per-view settings" : "Pay-per-view settings"}
      </button>

      {open && (
        <div className="mt-3 max-w-sm space-y-3 rounded-chip border border-line bg-canvas p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Let buyers pay-per-view to unlock this site (outside subscriptions)
          </label>

          {enabled && (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted">
                  Price per view (৳50–500) — you keep 80%, LinkLazy takes 20%
                </label>
                <input
                  type="number"
                  min={50}
                  max={500}
                  value={price}
                  onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : "")}
                  className="w-32 rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-signal"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={lifetime}
                    onChange={(e) => setLifetime(e.target.checked)}
                  />
                  Lifetime access after unlock
                </label>
                {!lifetime && (
                  <div className="mt-2">
                    <label className="mb-1 block text-xs text-muted">
                      Access length (days, min 1)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={durationDays}
                      onChange={(e) =>
                        setDurationDays(e.target.value ? Number(e.target.value) : "")
                      }
                      className="w-32 rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-signal"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
          {message && <p className="text-xs text-muted">{message}</p>}
        </div>
      )}
    </div>
  );
}
