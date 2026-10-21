"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/components/links/api";
import { NOTE_MAX, OPP_STATUSES, OPP_STATUS_LABELS, type OppStatus } from "@/lib/opportunities/rules";

export function OpportunityActions({ id, status, note }: { id: string; status: string; note: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState(note ?? "");
  const [editing, setEditing] = useState(false);

  async function patch(body: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/opportunities/${id}`, "PATCH", body);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    router.refresh();
    return true;
  }

  async function remove() {
    if (busy || !window.confirm("Delete this opportunity? (To hide it instead, set it to Ignored.)")) return;
    setBusy(true);
    const res = await apiRequest(`/api/opportunities/${id}`, "DELETE");
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="mt-2 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`st-${id}`} className="sr-only">Status</label>
        <select id={`st-${id}`} value={status} disabled={busy} onChange={(e) => void patch({ status: e.target.value as OppStatus })} className="rounded-chip border border-line px-2 py-1">
          {OPP_STATUSES.map((s) => <option key={s} value={s}>{OPP_STATUS_LABELS[s]}</option>)}
        </select>
        <button type="button" className="rounded-chip border border-line px-2 py-1" onClick={() => setEditing((v) => !v)}>{note ? "Edit note" : "Add note"}</button>
        <button type="button" disabled={busy} className="rounded-chip border border-line px-2 py-1 text-red-700" onClick={remove}>Delete</button>
      </div>
      {editing && (
        <div className="space-y-2">
          <label htmlFor={`nt-${id}`} className="sr-only">Note</label>
          <textarea id={`nt-${id}`} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={NOTE_MAX} className="w-full rounded-chip border border-line p-2" />
          <button
            type="button"
            disabled={busy}
            className="rounded-chip border border-line px-3 py-1"
            onClick={async () => {
              if (await patch({ note: text })) setEditing(false);
            }}
          >
            Save note
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
