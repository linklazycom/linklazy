"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/links/copy-button";
import { apiRequest } from "@/components/links/api";

export interface ApiKeyView {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  /** Computed on the server so rendering stays pure. */
  expired: boolean;
}

const SCOPES = [
  { id: "links:read", label: "Read links and click statistics" },
  { id: "links:write", label: "Create, edit and delete links" },
];
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null);

export function ApiKeyManager({ keys, canCreate }: { keys: ApiKeyView[]; canCreate: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["links:read"]);
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiRequest("/api/api-keys", "POST", { name, scopes, expires_in_days: expires ? Number(expires) : null });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setNewKey(String(res.data?.key ?? ""));
    setName("");
    router.refresh();
  }
  async function revoke(id: string, label: string) {
    if (!window.confirm(`Revoke "${label}"? Anything using this key stops working immediately.`)) return;
    setBusy(true);
    const res = await apiRequest(`/api/api-keys/${id}`, "DELETE");
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }
  const toggle = (id: string) => setScopes((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-6">
      {newKey && (
        <div className="space-y-2 rounded-chip border border-signal bg-signal-soft p-5">
          <p className="text-sm font-medium">Copy your new key now — it will not be shown again.</p>
          <code className="block break-all rounded-chip bg-white p-3 font-mono text-xs">{newKey}</code>
          <div className="flex gap-2">
            <CopyButton text={newKey} label="Copy key" />
            <Button size="sm" variant="ghost" type="button" onClick={() => setNewKey(null)}>
              I&apos;ve saved it
            </Button>
          </div>
        </div>
      )}

      {canCreate ? (
        <form onSubmit={create} className="space-y-4 rounded-chip border border-line bg-white p-5">
          <h2 className="font-display text-lg font-medium">Create an API key</h2>
          <Field id="key_name" label="Name" placeholder="My CRM integration" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} required />
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm text-muted">Permissions</legend>
            {SCOPES.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={scopes.includes(s.id)} onChange={() => toggle(s.id)} />
                {s.label}
              </label>
            ))}
          </fieldset>
          <div>
            <label htmlFor="key_expiry" className="mb-1 block text-sm text-muted">
              Expires
            </label>
            <select id="key_expiry" value={expires} onChange={(e) => setExpires(e.target.value)} className="rounded-chip border border-line bg-white px-3 py-2 text-sm">
              <option value="">Never</option>
              <option value="30">In 30 days</option>
              <option value="90">In 90 days</option>
              <option value="365">In 1 year</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button type="submit" disabled={busy || !name.trim() || scopes.length === 0}>
            {busy ? "Creating…" : "Create key"}
          </Button>
        </form>
      ) : (
        <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">You have reached your API-key limit. Revoke a key to create another.</p>
      )}

      <div className="overflow-x-auto rounded-chip border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Key</th>
              <th className="px-4 py-2">Permissions</th>
              <th className="px-4 py-2">Last used</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No API keys yet.
                </td>
              </tr>
            )}
            {keys.map((k) => {
              const expired = k.expired;
              const dead = !!k.revoked_at || expired;
              return (
                <tr key={k.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <span className={dead ? "text-muted line-through" : "font-medium"}>{k.name}</span>
                    <div className="text-xs text-muted">
                      {k.revoked_at ? `Revoked ${fmt(k.revoked_at)}` : expired ? `Expired ${fmt(k.expires_at)}` : k.expires_at ? `Expires ${fmt(k.expires_at)}` : `Created ${fmt(k.created_at)}`}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{k.key_prefix}…</td>
                  <td className="px-4 py-3 text-xs">{k.scopes.map((s) => s.replace("links:", "")).join(", ")}</td>
                  <td className="px-4 py-3 text-xs text-muted">{fmt(k.last_used_at) ?? "Never"}</td>
                  <td className="px-4 py-3 text-right">
                    {!dead && (
                      <Button size="sm" variant="ghost" type="button" disabled={busy} onClick={() => revoke(k.id, k.name)}>
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
