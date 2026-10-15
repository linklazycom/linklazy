"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

const REASONS = [
  { value: "phishing", label: "Phishing / scam" },
  { value: "malware", label: "Malware / harmful download" },
  { value: "spam", label: "Spam" },
  { value: "illegal", label: "Illegal content" },
  { value: "other", label: "Something else" },
];

export function ReportLinkForm({ initialLink }: { initialLink: string }) {
  const [link, setLink] = useState(initialLink);
  const [reason, setReason] = useState("phishing");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiRequest("/api/links/report", "POST", { link, reason, details: details || null, email: email || null, website });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-chip border border-signal/30 bg-signal-soft p-6 text-sm">
        Thank you. Our team will review this link. If it breaks our rules it will be disabled.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-chip border border-line bg-white p-5">
      <Field id="link" label="Short link or slug" placeholder="https://linklazy.com/l/abc123" value={link} onChange={(e) => setLink(e.target.value)} required />
      <div>
        <label htmlFor="reason" className="mb-1 block text-sm text-muted">
          What is wrong with it?
        </label>
        <select id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-chip border border-line bg-white px-3 py-2 text-sm">
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="details" className="mb-1 block text-sm text-muted">
          Details (optional)
        </label>
        <textarea id="details" value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={2000} className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal" />
      </div>
      <Field id="email" type="email" label="Your email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} hint="Only used if we need to ask you something." />
      {/* Honeypot: hidden from people, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Sending…" : "Submit report"}
      </Button>
    </form>
  );
}
