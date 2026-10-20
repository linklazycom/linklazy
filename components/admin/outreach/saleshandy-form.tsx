"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";
import { FIELD_DEFS, type FieldMap } from "@/lib/outreach/saleshandy";

const inputClass = "w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal";

interface Props {
  keyHint: string | null;
  fieldMap: FieldMap;
  lastTest: { at: string | null; ok: boolean | null; message: string | null };
  webhookUrl: string | null;
}

export function SaleshandyForm({ keyHint, fieldMap, lastTest, webhookUrl }: Props) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [fields, setFields] = useState<Record<string, string>>(() => Object.fromEntries(FIELD_DEFS.map((f) => [f.key, fieldMap[f.key] ?? ""])));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string; section: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function call(section: string, body: Record<string, unknown>, okText: string) {
    if (busy) return;
    setBusy(section);
    setMessage(null);
    const res = await apiRequest("/api/admin/outreach/saleshandy", "POST", body);
    setBusy(null);
    if (!res.ok) return setMessage({ kind: "error", text: res.error ?? "Something went wrong.", section });
    const text = typeof res.data?.message === "string" ? res.data.message : okText;
    setMessage({ kind: res.data?.ok === false ? "error" : "ok", text, section });
    if (body.action === "save_key") setApiKey("");
    router.refresh();
  }

  async function copyUrl() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMessage({ kind: "error", text: "Could not copy. Select the address and copy it by hand.", section: "webhook" });
    }
  }

  const note = (section: string) =>
    message?.section === section && (
      <p role={message.kind === "error" ? "alert" : "status"} className={`text-sm ${message.kind === "error" ? "text-red-700" : "text-green-700"}`}>
        {message.text}
      </p>
    );

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-chip border border-line bg-white p-5">
        <div>
          <h2 className="font-display text-lg font-medium">1. API key</h2>
          <p className="text-sm text-muted">
            In Saleshandy open Settings &gt; API Key &gt; Create Key, copy it and paste it here. It is stored encrypted and never shown again{keyHint ? ` (saved key ends in ${keyHint})` : ""}.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void call("key", { action: "save_key", api_key: apiKey }, "Key saved.");
          }}
          className="flex flex-wrap gap-2"
        >
          <input aria-label="Saleshandy API key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={keyHint ? "Paste a new key to replace the saved one" : "Paste your API key"} className={`${inputClass} max-w-md`} />
          <Button type="submit" size="sm" disabled={busy !== null || apiKey.trim().length < 16}>{busy === "key" ? "Saving…" : "Save key"}</Button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={busy !== null || !keyHint} onClick={() => call("test", { action: "test" }, "Connected.")}>{busy === "test" ? "Testing…" : "Test connection"}</Button>
          {keyHint && (
            <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => window.confirm("Remove the saved key? Sending stops until you save a key again.") && void call("key", { action: "disconnect" }, "Disconnected.")}>Disconnect</Button>
          )}
        </div>
        {note("key")}
        {note("test")}
        {lastTest.at && (
          <p className="text-xs text-muted">
            Last test {lastTest.at.slice(0, 16).replace("T", " ")} UTC: {lastTest.ok ? "OK" : "failed"}{lastTest.message ? ` — ${lastTest.message}` : ""}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-chip border border-line bg-white p-5">
        <div>
          <h2 className="font-display text-lg font-medium">2. Prospect field ids</h2>
          <p className="text-sm text-muted">
            Saleshandy identifies each prospect field by an id. In Saleshandy go to Settings &gt; Prospect Fields (system fields and custom fields) and copy each id. Create the four custom fields with <strong>exactly</strong> the names shown, so the ready-made email template works. Only Email is required, but leave the listing fields empty and the emails will have no listing or price.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void call("fields", { action: "save_fields", field_map: fields }, "Field ids saved.");
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          {FIELD_DEFS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`f-${f.key}`} className="mb-1 block text-sm text-muted">
                {f.label}
                {f.required ? " *" : ""} <span className="text-xs">({f.custom ? `custom field named "${f.saleshandyName}"` : "system field"})</span>
              </label>
              <input id={`f-${f.key}`} value={fields[f.key] ?? ""} maxLength={60} onChange={(e) => setFields((v) => ({ ...v, [f.key]: e.target.value }))} className={`${inputClass} font-mono`} />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={busy !== null || !fields.email?.trim()}>{busy === "fields" ? "Saving…" : "Save field ids"}</Button>
          </div>
        </form>
        {note("fields")}
      </section>

      <section className="space-y-3 rounded-chip border border-line bg-white p-5">
        <div>
          <h2 className="font-display text-lg font-medium">3. Webhook (replies, bounces, unsubscribes)</h2>
          <p className="text-sm text-muted">
            In Saleshandy open Settings &gt; Integrations &gt; Webhooks, add a webhook with the address below and tick: email sent, reply received, email bounced, prospect unsubscribed, prospect finished (opens and clicks are optional). The address contains a secret: treat it like a password.
          </p>
        </div>
        {webhookUrl ? (
          <div className="flex flex-wrap gap-2">
            <input readOnly aria-label="Webhook address" value={webhookUrl} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} max-w-2xl font-mono text-xs`} />
            <Button type="button" size="sm" variant="secondary" onClick={copyUrl}>{copied ? "Copied" : "Copy"}</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => window.confirm("Make a new address? The old one stops working, so update it in Saleshandy straight away.") && void call("webhook", { action: "rotate_webhook" }, "New address created.")}>New address</Button>
          </div>
        ) : (
          <p className="text-sm text-muted">The address appears after you save the API key.</p>
        )}
        {note("webhook")}
      </section>
    </div>
  );
}
