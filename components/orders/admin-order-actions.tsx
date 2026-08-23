"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const ACTIONS = [
  { key: "force_accept", label: "Force-accept", confirm: "Mark this order accepted and release any escrowed payment to the seller?" },
  { key: "cancel", label: "Cancel", confirm: "Cancel this order and refund any escrowed payment to the buyer?" },
  { key: "refund", label: "Refund", confirm: "Refund this order to the buyer?" },
] as const;

export function AdminOrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extending, setExtending] = useState(false);
  const [note, setNote] = useState("");

  const terminal = ["accepted", "cancelled", "refunded"].includes(status);

  async function runAction(action: string, extra?: Record<string, unknown>) {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: note || undefined, ...extra }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Action failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-chip border border-line bg-white p-4">
      <p className="mb-3 text-sm font-medium">Admin controls</p>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note — logged with whichever action you take"
        rows={2}
        className="mb-3 w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
      />

      {!terminal && (
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <Button
              key={a.key}
              variant={a.key === "force_accept" ? "primary" : "secondary"}
              disabled={busy !== null}
              onClick={() => {
                if (window.confirm(a.confirm)) runAction(a.key);
              }}
            >
              {busy === a.key ? "Working…" : a.label}
            </Button>
          ))}

          {!extending ? (
            <Button variant="secondary" disabled={busy !== null} onClick={() => setExtending(true)}>
              Extend deadline
            </Button>
          ) : (
            <ExtendDeadlineForm
              busy={busy === "extend_deadline"}
              onSubmit={(hours) => runAction("extend_deadline", { extend_hours: hours })}
              onCancel={() => setExtending(false)}
            />
          )}
        </div>
      )}

      {terminal && (
        <p className="text-sm text-muted">
          This order is already {status} — no further overrides available.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ExtendDeadlineForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (hours: number) => void;
  onCancel: () => void;
}) {
  const [hours, setHours] = useState(24);
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        max={720}
        value={hours}
        onChange={(e) => setHours(Number(e.target.value))}
        className="w-20 rounded-chip border border-line px-2 py-2 text-sm outline-none focus:border-signal"
      />
      <span className="text-sm text-muted">hours</span>
      <Button disabled={busy} onClick={() => onSubmit(hours)}>
        {busy ? "Working…" : "Apply"}
      </Button>
      <Button variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
