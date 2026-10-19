"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast-provider";

export interface ProviderView {
  id: string;
  name: string;
  kind?: string;
  adapter: string;
  base_url: string | null;
  model: string | null;
  priority: number;
  enabled: boolean;
  daily_limit: number | null;
  monthly_limit: number | null;
  notes: string | null;
  has_key: boolean;
  key_hint: string | null;
  used_today: number;
  used_month: number;
}

export interface FlagView {
  key: string;
  label: string;
  on: boolean;
}

const ADAPTERS = [
  { value: "openai_compatible", label: "OpenAI-compatible (OpenAI, Groq, OpenRouter, Together, Mistral, DeepSeek, Gemini OpenAI-mode, self-hosted…)" },
  { value: "anthropic", label: "Anthropic (Claude)" },
];

const IMAGE_ADAPTERS = [
  { value: "pexels", label: "Pexels (free API key; credit the photographer)" },
  { value: "pixabay", label: "Pixabay (free API key; images are linked, not stored)" },
];

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function ApiProvidersManager({
  providers,
  flags,
  encryptionConfigured,
}: {
  providers: ProviderView[];
  flags: FlagView[];
  encryptionConfigured: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    kind: "ai",
    adapter: "openai_compatible",
    base_url: "",
    model: "",
    api_key: "",
    priority: "100",
    daily_limit: "",
    monthly_limit: "",
  });

  function setField(name: string, value: string) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function toggleFlag(flag: FlagView) {
    setBusy(`flag-${flag.key}`);
    const { ok } = await api("/api/settings", "POST", { key: flag.key, value: flag.on ? "off" : "on" });
    setBusy(null);
    if (!ok) toast({ title: "Could not change the switch", tone: "error" });
    router.refresh();
  }

  async function addProvider(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    const { ok, data } = await api("/api/admin/api-providers", "POST", form);
    setBusy(null);
    if (!ok) {
      toast({ title: data.error ?? "Could not add provider", tone: "error" });
      return;
    }
    toast({ title: "Provider added (it starts switched OFF — test it, then enable)", tone: "success" });
    setShowForm(false);
    setForm({ ...form, name: "", base_url: "", model: "", api_key: "" });
    router.refresh();
  }

  async function toggleProvider(p: ProviderView) {
    setBusy(p.id);
    const { ok, data } = await api(`/api/admin/api-providers/${p.id}`, "PATCH", { enabled: !p.enabled });
    setBusy(null);
    if (!ok) toast({ title: data.error ?? "Could not update", tone: "error" });
    router.refresh();
  }

  async function testProvider(p: ProviderView) {
    setBusy(`test-${p.id}`);
    const { data } = await api(`/api/admin/api-providers/${p.id}/test`, "POST");
    setBusy(null);
    toast({
      title: data.ok ? `${p.name}: connected (${data.ms} ms)` : `${p.name}: ${data.message ?? "failed"}`,
      tone: data.ok ? "success" : "error",
    });
    router.refresh();
  }

  async function changeKey(p: ProviderView) {
    const key = window.prompt(`Paste the new API key for "${p.name}" (it will be stored encrypted):`);
    if (!key?.trim()) return;
    setBusy(p.id);
    const { ok, data } = await api(`/api/admin/api-providers/${p.id}`, "PATCH", { api_key: key });
    setBusy(null);
    toast({ title: ok ? "API key updated" : data.error ?? "Could not update key", tone: ok ? "success" : "error" });
    router.refresh();
  }

  async function editLimits(p: ProviderView) {
    const daily = window.prompt("Daily call limit (empty = unlimited):", p.daily_limit?.toString() ?? "");
    if (daily === null) return;
    const monthly = window.prompt("Monthly call limit (empty = unlimited):", p.monthly_limit?.toString() ?? "");
    if (monthly === null) return;
    setBusy(p.id);
    const { ok, data } = await api(`/api/admin/api-providers/${p.id}`, "PATCH", { daily_limit: daily, monthly_limit: monthly });
    setBusy(null);
    toast({ title: ok ? "Limits updated" : data.error ?? "Could not update limits", tone: ok ? "success" : "error" });
    router.refresh();
  }

  async function removeProvider(p: ProviderView) {
    if (!window.confirm(`Delete provider "${p.name}"? Its saved key is erased. Usage history stays.`)) return;
    setBusy(p.id);
    const { ok, data } = await api(`/api/admin/api-providers/${p.id}`, "DELETE");
    setBusy(null);
    toast({ title: ok ? "Provider deleted" : data.error ?? "Could not delete", tone: ok ? "success" : "error" });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {!encryptionConfigured && (
        <div className="rounded-chip border border-line bg-white p-4 text-sm">
          <p className="font-medium">Setup needed: encryption key</p>
          <p className="mt-1 text-muted">
            Add an environment variable <code className="font-mono">PROVIDER_KEY_ENCRYPTION_SECRET</code> (a long random
            string, 32+ characters) in Vercel → Settings → Environment Variables, then redeploy. Until then API keys
            cannot be saved.
          </p>
        </div>
      )}

      <section className="rounded-chip border border-line bg-white p-5">
        <h2 className="mb-1 font-display text-lg font-medium">Kill switches</h2>
        <p className="mb-4 text-sm text-muted">
          Take effect instantly. When something is off, users see “currently unavailable” and are never charged.
        </p>
        <div className="divide-y divide-line">
          {flags.map((f) => (
            <div key={f.key} className="flex items-center justify-between py-3">
              <span className="text-sm">{f.label}</span>
              <Button
                type="button"
                size="sm"
                variant={f.on ? "primary" : "secondary"}
                disabled={busy === `flag-${f.key}`}
                onClick={() => toggleFlag(f)}
              >
                {f.on ? "ON" : "OFF"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-medium">API providers (AI text and stock images)</h2>
          <Button type="button" size="sm" onClick={() => setShowForm((v) => !v)} disabled={!encryptionConfigured}>
            {showForm ? "Close" : "Add provider"}
          </Button>
        </div>

        {showForm && (
          <form onSubmit={addProvider} className="mb-5 space-y-3 rounded-chip border border-line bg-white p-5">
            <Field id="p-name" label="Name (your label)" value={form.name} onChange={(e) => setField("name", e.target.value)} required maxLength={80} />
            <div>
              <label htmlFor="p-kind" className="mb-1 block text-sm text-muted">Kind</label>
              <select
                id="p-kind"
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value, adapter: e.target.value === "image" ? "pexels" : "openai_compatible", model: "" }))}
                className="w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal"
              >
                <option value="ai">AI text model</option>
                <option value="image">Stock images</option>
              </select>
            </div>
            <div>
              <label htmlFor="p-adapter" className="mb-1 block text-sm text-muted">Type</label>
              <select
                id="p-adapter"
                value={form.adapter}
                onChange={(e) => setField("adapter", e.target.value)}
                className="w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal"
              >
                {(form.kind === "image" ? IMAGE_ADAPTERS : ADAPTERS).map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <Field
              id="p-base"
              label="Base URL (optional)"
              hint="Leave empty for OpenAI / Anthropic / Pexels / Pixabay. For others, e.g. https://api.groq.com/openai/v1 — must be a public https address."
              value={form.base_url}
              onChange={(e) => setField("base_url", e.target.value)}
            />
            {form.kind === "ai" && (
              <Field
                id="p-model"
                label="Model name"
                hint="Exactly as shown in the provider's dashboard/docs (model names change over time)."
                value={form.model}
                onChange={(e) => setField("model", e.target.value)}
                required
              />
            )}
            <Field
              id="p-key"
              label="API key"
              type="password"
              autoComplete="off"
              hint="Stored encrypted. It is never shown again — only a masked hint."
              value={form.api_key}
              onChange={(e) => setField("api_key", e.target.value)}
              required
            />
            <div className="grid grid-cols-3 gap-3">
              <Field id="p-prio" label="Priority (low = first)" type="number" min={0} value={form.priority} onChange={(e) => setField("priority", e.target.value)} />
              <Field id="p-daily" label="Daily limit" type="number" min={0} placeholder="unlimited" value={form.daily_limit} onChange={(e) => setField("daily_limit", e.target.value)} />
              <Field id="p-monthly" label="Monthly limit" type="number" min={0} placeholder="unlimited" value={form.monthly_limit} onChange={(e) => setField("monthly_limit", e.target.value)} />
            </div>
            <Button type="submit" disabled={busy === "add"}>
              {busy === "add" ? "Saving…" : "Save provider"}
            </Button>
          </form>
        )}

        {providers.length === 0 ? (
          <p className="rounded-chip border border-line bg-white p-5 text-sm text-muted">
            No providers yet. AI features stay in “setup” state until you add and enable one.
          </p>
        ) : (
          <div className="space-y-3">
            {providers.map((p) => (
              <div key={p.id} className="rounded-chip border border-line bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-xs text-muted">
                      {p.kind === "image" ? "image" : "ai"} · {p.adapter} · {p.kind === "image" ? "no model needed" : p.model ?? "no model"} · priority {p.priority}
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${p.enabled ? "text-green-700" : "text-muted"}`}>
                    {p.enabled ? "ENABLED" : "OFF"}
                  </span>
                </div>
                <p className="mb-3 text-xs text-muted">
                  Key: {p.has_key ? p.key_hint ?? "saved" : "missing"} · Today: {p.used_today}
                  {p.daily_limit !== null ? ` / ${p.daily_limit}` : ""} · This month: {p.used_month}
                  {p.monthly_limit !== null ? ` / ${p.monthly_limit}` : ""}
                  {p.base_url ? ` · ${p.base_url}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" disabled={busy === `test-${p.id}`} onClick={() => testProvider(p)}>
                    {busy === `test-${p.id}` ? "Testing…" : "Test connection"}
                  </Button>
                  <Button type="button" size="sm" variant={p.enabled ? "secondary" : "primary"} disabled={busy === p.id} onClick={() => toggleProvider(p)}>
                    {p.enabled ? "Switch off" : "Enable"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={busy === p.id} onClick={() => changeKey(p)}>
                    Change key
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={busy === p.id} onClick={() => editLimits(p)}>
                    Limits
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={busy === p.id} onClick={() => removeProvider(p)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-muted">
        Search providers are added in a later batch. Free-tier terms change often — check each provider&apos;s
        current limits and data-use terms before enabling it.
      </p>
    </div>
  );
}
