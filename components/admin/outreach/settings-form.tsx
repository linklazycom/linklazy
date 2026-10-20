"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

const inputClass = "w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal";

export function OutreachSenderForm({ initial }: { initial: { name: string; address: string } }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await apiRequest("/api/admin/outreach/settings", "POST", { name, address });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-chip border border-line bg-white p-5">
      <div>
        <h2 className="font-display text-lg font-medium">Sender identity</h2>
        <p className="text-sm text-muted">Shown at the bottom of every outreach email, as marketing-email rules require. Sending stays blocked until both are filled in.</p>
      </div>
      <div>
        <label htmlFor="s-name" className="mb-1 block text-sm text-muted">Business or sender name</label>
        <input id="s-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="s-addr" className="mb-1 block text-sm text-muted">Postal address (street, city, country)</label>
        <textarea id="s-addr" rows={3} value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
      </div>
      <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
    </form>
  );
}
