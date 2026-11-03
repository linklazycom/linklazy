"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/components/links/api";
import { OPP_BULK_MAX, OPP_STATUS_LABELS, type OppStatus } from "@/lib/opportunities/rules";

/**
 * Select several opportunities and give them the same status in one go (Batch 23C). The provider wraps the list; each row has a
 * SelectBox; the BulkBar shows the count and the buttons. The page itself stays a server component.
 */
interface BulkState {
  selected: Set<string>;
  toggle: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
  clear: () => void;
}
const BulkContext = createContext<BulkState | null>(null);

export function BulkProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else if (n.size < OPP_BULK_MAX) n.add(id);
    return n;
  }), []);
  const setMany = useCallback((ids: string[], on: boolean) => setSelected((s) => {
    const n = new Set(s);
    for (const id of ids) {
      if (on && n.size < OPP_BULK_MAX) n.add(id);
      if (!on) n.delete(id);
    }
    return n;
  }), []);
  const clear = useCallback(() => setSelected(new Set()), []);
  const value = useMemo(() => ({ selected, toggle, setMany, clear }), [selected, toggle, setMany, clear]);
  return <BulkContext.Provider value={value}>{children}</BulkContext.Provider>;
}

export function SelectBox({ id }: { id: string }) {
  const ctx = useContext(BulkContext);
  if (!ctx) return null;
  return (
    <label className="flex items-center gap-1 text-xs text-muted">
      <input type="checkbox" checked={ctx.selected.has(id)} onChange={() => ctx.toggle(id)} aria-label="Select this opportunity" />
      <span className="sr-only">Select</span>
    </label>
  );
}

const BULK_STATUSES: OppStatus[] = ["saved", "contacted", "done", "ignored"];

export function BulkBar({ pageIds }: { pageIds: string[] }) {
  const ctx = useContext(BulkContext);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!ctx || pageIds.length === 0) return null;
  const count = ctx.selected.size;
  const allOnPage = pageIds.every((id) => ctx.selected.has(id));

  async function apply(status: OppStatus) {
    if (busy || !ctx || count === 0) return;
    if (status === "ignored" && !window.confirm(`Hide ${count} opportunit${count === 1 ? "y" : "ies"}? You can still find them under "All, incl. ignored".`)) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest("/api/opportunities/bulk", "POST", { ids: Array.from(ctx.selected), status });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    ctx.clear();
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-chip border border-line bg-white p-2 text-sm">
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={allOnPage} onChange={(e) => ctx.setMany(pageIds, e.target.checked)} />
        Select all on this page
      </label>
      <span className="text-muted">{count} selected{count >= OPP_BULK_MAX ? ` (most ${OPP_BULK_MAX})` : ""}</span>
      <span className="ml-auto flex flex-wrap items-center gap-2">
        <span className="text-muted">Mark as:</span>
        {BULK_STATUSES.map((s) => (
          <button key={s} type="button" disabled={busy || count === 0} onClick={() => void apply(s)} className="rounded-chip border border-line px-2 py-1 disabled:opacity-50">
            {OPP_STATUS_LABELS[s]}
          </button>
        ))}
      </span>
      {error && <p role="alert" className="w-full text-xs text-red-700">{error}</p>}
    </div>
  );
}
