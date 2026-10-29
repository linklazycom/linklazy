"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Finding { name: string; host: string; ok: boolean; required: boolean; detail: string }
interface Health { apiKeySet: boolean; fromSet: boolean; domain: string | null; findings: Finding[] }

export function EmailHealthCard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function check() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/email-health");
    setBusy(false);
    if (!res.ok) return setMessage("Could not run the check.");
    setHealth(await res.json());
  }

  async function sendTest() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/email-health", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(res.ok ? `Test email sent to ${body.sentTo}. Check your inbox and spam folder.` : `Failed: ${typeof body.error === "string" ? body.error : "unknown error"}`);
  }

  return (
    <div className="space-y-3 rounded-chip border border-line bg-white p-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={check}>Check email setup</Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={sendTest}>Send me a test email</Button>
      </div>
      {health && (
        <div className="space-y-1">
          <p>{health.apiKeySet ? "✅" : "❌"} RESEND_API_KEY {health.apiKeySet ? "is set" : "is missing in Vercel"}</p>
          <p>{health.fromSet ? "✅" : "❌"} EMAIL_FROM {health.fromSet ? `is set (domain: ${health.domain ?? "not readable"})` : "is missing in Vercel"}</p>
          {health.findings.map((f) => (
            <p key={f.name}>
              {f.ok ? "✅" : f.required ? "❌" : "⚠️"} {f.name} <span className="font-mono text-xs text-muted">{f.host}</span> — {f.detail}
            </p>
          ))}
          <p className="text-xs text-muted">এটি শুধু দ্বিতীয় মত; চূড়ান্ত অবস্থা Resend &gt; Domains-এ দেখুন।</p>
        </div>
      )}
      {message && <p className="text-muted">{message}</p>}
    </div>
  );
}
