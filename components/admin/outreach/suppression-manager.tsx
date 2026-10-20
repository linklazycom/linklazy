"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export interface SuppressionRow {
  id: string;
  email: string;
  reason: string;
  created_at: string;
}

const inputClass = "w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal";

export function SuppressionManager({ rows, total }: { rows: SuppressionRow[]; total: number }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await apiRequest("/api/admin/outreach/suppressions", "POST", { emails: text });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setMessage(`Added ${res.data?.added ?? 0}. Already listed: ${res.data?.alreadyListed ?? 0}. Not valid: ${res.data?.invalid ?? 0}.`);
    setText("");
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this address from the do-not-email list?")) return;
    setError(null);
    const res = await apiRequest(`/api/admin/outreach/suppressions?id=${id}`, "DELETE");
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-chip border border-line bg-white p-5">
      <div>
        <h2 className="font-display text-lg font-medium">Do-not-email list ({total})</h2>
        <p className="text-sm text-muted">
          Anyone who unsubscribes, bounces or complains is added automatically and can never be mailed again. Add other people who asked not to be contacted here (one per line). Entries you add by hand can be removed; automatic ones cannot.
        </p>
      </div>
      <form onSubmit={add} className="space-y-2">
        <textarea aria-label="Addresses to add" rows={3} value={text} onChange={(e) => setText(e.target.value)} className={inputClass} placeholder="someone@example-site.com" />
        <Button type="submit" size="sm" variant="secondary" disabled={busy || !text.trim()}>{busy ? "Adding…" : "Add to the list"}</Button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      {rows.length > 0 && (
        <ul className="divide-y divide-line rounded-chip border border-line text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-2">
              <span>
                {r.email} <span className="text-xs text-muted">· {r.reason} · {r.created_at.slice(0, 10)}</span>
              </span>
              {r.reason === "manual" && (
                <button type="button" className="text-xs underline" onClick={() => remove(r.id)}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {total > rows.length && <p className="text-xs text-muted">Showing the latest {rows.length} of {total}.</p>}
    </section>
  );
}
