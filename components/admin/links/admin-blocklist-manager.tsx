"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export interface BlocklistEntry {
  id: string;
  kind: string;
  value: string;
  reason: string | null;
  created_at: string;
}

export function AdminBlocklistManager({ entries }: { entries: BlocklistEntry[] }) {
  const router = useRouter();
  const [kind, setKind] = useState("domain");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiRequest("/api/admin/links/blocklist", "POST", { kind, value, reason: reason || null });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setValue("");
    setReason("");
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this entry from the blocklist?")) return;
    const res = await apiRequest(`/api/admin/links/blocklist?id=${id}`, "DELETE");
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="flex flex-wrap items-end gap-3 rounded-chip border border-line bg-white p-4">
        <div>
          <label htmlFor="kind" className="mb-1 block text-sm text-muted">
            Type
          </label>
          <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-chip border border-line bg-white px-3 py-2 text-sm">
            <option value="domain">Domain (blocks it and all subdomains)</option>
            <option value="slug">Slug</option>
          </select>
        </div>
        <div className="min-w-[14rem] flex-1">
          <Field id="value" label={kind === "domain" ? "Domain" : "Slug"} placeholder={kind === "domain" ? "evil-example.com" : "free-money"} value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>
        <div className="min-w-[12rem] flex-1">
          <Field id="reason" label="Reason (admin only)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add"}
        </Button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      <div className="space-y-2">
        {entries.map((en) => (
          <div key={en.id} className="flex flex-wrap items-center justify-between gap-3 rounded-chip border border-line bg-white p-3 text-sm">
            <div>
              <span className="mr-2 rounded-full bg-line/60 px-2 py-0.5 text-xs">{en.kind}</span>
              <span className="font-mono">{en.value}</span>
              {en.reason && <span className="ml-2 text-xs text-muted">— {en.reason}</span>}
            </div>
            <Button size="sm" variant="ghost" type="button" onClick={() => remove(en.id)}>
              Remove
            </Button>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-muted">The blocklist is empty.</p>}
      </div>
    </div>
  );
}
