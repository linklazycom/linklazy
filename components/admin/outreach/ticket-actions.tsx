"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/components/links/api";
import { TICKET_STATUSES, TICKET_STATUS_LABELS, type TicketStatus } from "@/lib/outreach/reply";

export function TicketActions({ id, status, canStop }: { id: string; status: string; canStop: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function patch(body: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/admin/outreach/tickets/${id}`, "PATCH", body);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    router.refresh();
    return true;
  }

  async function stop() {
    if (busy) return;
    if (!window.confirm("Add this address to the do-not-email list and close the ticket? This cannot be undone from the admin screen.")) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/admin/outreach/tickets/${id}/stop`, "POST");
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="ticket-status" className="text-muted">Status</label>
        <select id="ticket-status" value={status} disabled={busy} onChange={(e) => void patch({ status: e.target.value as TicketStatus })} className="rounded-chip border border-line px-2 py-1">
          {TICKET_STATUSES.map((s) => <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>)}
        </select>
        {canStop && <button type="button" disabled={busy} onClick={stop} className="rounded-chip border border-line px-3 py-1 text-red-700">Do not email again</button>}
      </div>
      <div className="space-y-2">
        <label htmlFor="ticket-note" className="text-sm text-muted">Private note (only you see it)</label>
        <textarea id="ticket-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} className="w-full rounded-chip border border-line p-2 text-sm" />
        <button
          type="button"
          disabled={busy || !note.trim()}
          className="rounded-chip border border-line px-3 py-1 text-sm"
          onClick={async () => {
            if (await patch({ note })) setNote("");
          }}
        >
          Save note
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
