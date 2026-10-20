"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";
import { HOLD_REASON_LABELS, type HoldReason } from "@/lib/outreach/rules";

export function HeldActions({ groups }: { groups: { reason: HoldReason; count: number }[] }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function act(reason: HoldReason, action: "release_held" | "block_held") {
    if (busy) return;
    if (action === "block_held" && !window.confirm("Block all of these contacts so they are never emailed?")) return;
    setBusy(`${reason}-${action}`);
    setError(null);
    setMessage(null);
    const res = await apiRequest("/api/admin/outreach/contacts/bulk", "POST", { action, reason, confirm: confirm[reason] ?? "" });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setMessage(`${res.data?.changed ?? 0} contacts updated.`);
    router.refresh();
  }

  if (groups.length === 0) return null;
  return (
    <section className="space-y-3 rounded-chip border border-amber-300 bg-amber-50 p-5">
      <div>
        <h2 className="font-display text-lg font-medium">Held contacts</h2>
        <p className="text-sm text-muted">These people are not emailed until you decide. Releasing them is your decision and your responsibility: check the law for their country and that you have a valid reason to contact them.</p>
      </div>
      {groups.map((g) => (
        <div key={g.reason} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-64 font-medium">
            {HOLD_REASON_LABELS[g.reason]}: {g.count}
          </span>
          <input
            aria-label={`Type RELEASE to confirm for ${HOLD_REASON_LABELS[g.reason]}`}
            value={confirm[g.reason] ?? ""}
            onChange={(e) => setConfirm((c) => ({ ...c, [g.reason]: e.target.value }))}
            placeholder="Type RELEASE"
            className="w-32 rounded-chip border border-line bg-white px-2 py-1 text-sm"
          />
          <Button type="button" size="sm" variant="secondary" disabled={busy !== null || (confirm[g.reason] ?? "") !== "RELEASE"} onClick={() => act(g.reason, "release_held")}>
            Release
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => act(g.reason, "block_held")}>
            Block all
          </Button>
        </div>
      ))}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
    </section>
  );
}
