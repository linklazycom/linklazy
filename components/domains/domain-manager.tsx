"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/links/copy-button";
import { apiRequest } from "@/components/links/api";
import { cn } from "@/lib/utils";

export interface DomainView {
  id: string;
  hostname: string;
  status: "pending" | "verified" | "active" | "disabled";
  root_redirect_url: string | null;
  last_error: string | null;
  last_checked_at: string | null;
  disabled_note: string | null;
  txtName: string;
  txtValue: string;
  routeType: "CNAME" | "A";
  routeName: string;
  routeValue: string;
}

const STATUS_STYLE: Record<DomainView["status"], string> = {
  pending: "bg-amber-soft text-amber",
  verified: "bg-brand-soft text-brand-violet",
  active: "bg-signal-soft text-signal",
  disabled: "bg-red-50 text-red-700",
};
const STATUS_LABEL: Record<DomainView["status"], string> = {
  pending: "Waiting for DNS",
  verified: "Ownership confirmed",
  active: "Active",
  disabled: "Disabled",
};

function DnsRecord({ label, type, name, value }: { label: string; type: string; name: string; value: string }) {
  return (
    <div className="rounded-chip border border-line bg-paper p-3 text-xs">
      <p className="mb-2 font-medium text-ink">{label}</p>
      <div className="grid gap-2 sm:grid-cols-[70px_1fr_auto] sm:items-center">
        <span className="text-muted">Type</span>
        <code className="font-mono">{type}</code>
        <span />
        <span className="text-muted">Name / Host</span>
        <code className="break-all font-mono">{name}</code>
        <CopyButton text={name} />
        <span className="text-muted">Value</span>
        <code className="break-all font-mono">{value}</code>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function DomainCard({ d, mode }: { d: DomainView; mode: "automatic" | "manual" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [root, setRoot] = useState(d.root_redirect_url ?? "");
  const [rootMsg, setRootMsg] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setMsg(null);
    const res = await apiRequest(`/api/domains/${d.id}/verify`, "POST");
    setBusy(false);
    if (!res.ok) return setMsg(res.error);
    router.refresh();
  }
  async function remove() {
    if (!window.confirm(`Remove ${d.hostname}? Links will stop working on this domain (they keep working on linklazy.com).`)) return;
    setBusy(true);
    const res = await apiRequest(`/api/domains/${d.id}`, "DELETE");
    setBusy(false);
    if (!res.ok) return setMsg(res.error);
    router.refresh();
  }
  async function saveRoot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setRootMsg(null);
    const res = await apiRequest(`/api/domains/${d.id}`, "PATCH", { root_redirect_url: root.trim() || null });
    setBusy(false);
    setRootMsg(res.ok ? "Saved." : res.error);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-4 rounded-chip border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="break-all font-mono text-base font-medium">{d.hostname}</h3>
        <span className={cn("rounded-chip px-2 py-0.5 text-xs font-medium", STATUS_STYLE[d.status])}>{STATUS_LABEL[d.status]}</span>
      </div>

      {d.status === "disabled" && <p className="text-sm text-red-700">This domain was switched off by an administrator. Contact support if you think this is a mistake.</p>}

      {d.status === "pending" && (
        <>
          <p className="text-sm text-muted">Step 1 — prove you control this domain by adding this DNS record at your domain provider:</p>
          <DnsRecord label="Ownership record" type="TXT" name={d.txtName} value={d.txtValue} />
        </>
      )}
      {(d.status === "pending" || d.status === "verified") && (
        <>
          <p className="text-sm text-muted">
            {d.status === "pending" ? "Step 2" : "Next"} — point the domain to LinkLazy{mode === "manual" ? " (our team finishes the connection after your DNS is correct)" : ""}:
          </p>
          <DnsRecord label="Routing record" type={d.routeType} name={d.routeName} value={d.routeValue} />
          <p className="text-xs text-muted">If your provider offers a proxy (for example Cloudflare&apos;s orange cloud), turn it off for this record. DNS changes can take a few minutes to appear.</p>
        </>
      )}

      {d.status === "active" && (
        <p className="text-sm text-muted">
          All your short links now also work on this domain, for example <code className="font-mono">https://{d.hostname}/your-slug</code>.
        </p>
      )}

      {d.last_error && d.status !== "active" && d.status !== "disabled" && <p className="rounded-chip bg-amber-soft px-3 py-2 text-sm text-amber">{d.last_error}</p>}
      {msg && <p className="text-sm text-red-600">{msg}</p>}

      {d.status === "active" && (
        <form onSubmit={saveRoot} className="space-y-2 border-t border-line pt-4">
          <Field
            id={`root-${d.id}`}
            label="Where should the bare domain go? (optional)"
            hint={`Visitors who open https://${d.hostname}/ without a slug are sent here. Leave empty to show a "not found" page.`}
            placeholder="https://yourbrand.com"
            value={root}
            onChange={(e) => setRoot(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button size="sm" variant="secondary" type="submit" disabled={busy}>
              Save
            </Button>
            {rootMsg && <span className={cn("text-xs", rootMsg === "Saved." ? "text-signal" : "text-red-600")}>{rootMsg}</span>}
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {(d.status === "pending" || d.status === "verified") && (
          <Button size="sm" type="button" disabled={busy} onClick={check}>
            {busy ? "Checking…" : "Check again"}
          </Button>
        )}
        <Button size="sm" variant="ghost" type="button" disabled={busy} onClick={remove}>
          Remove
        </Button>
      </div>
    </div>
  );
}

export function DomainManager({ domains, mode, canAdd }: { domains: DomainView[]; mode: "automatic" | "manual"; canAdd: boolean }) {
  const router = useRouter();
  const [hostname, setHostname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiRequest("/api/domains", "POST", { hostname });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setHostname("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {canAdd ? (
        <form onSubmit={add} className="space-y-3 rounded-chip border border-line bg-white p-5">
          <h2 className="font-display text-lg font-medium">Add a custom domain</h2>
          <Field
            id="hostname"
            label="Domain"
            placeholder="go.yourbrand.com"
            hint="A subdomain such as go.yourbrand.com or links.yourbrand.com works best."
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            required
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button type="submit" disabled={busy || !hostname.trim()}>
            {busy ? "Adding…" : "Add domain"}
          </Button>
        </form>
      ) : (
        <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">You have reached your custom-domain limit. Remove a domain to add another.</p>
      )}
      {domains.map((d) => (
        <DomainCard key={d.id} d={d} mode={mode} />
      ))}
    </div>
  );
}
