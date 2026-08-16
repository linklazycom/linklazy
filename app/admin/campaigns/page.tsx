"use client";

import { useEffect, useState } from "react";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";

interface Campaign {
  id: string;
  subject: string;
  segment_role: "all" | "buyer" | "seller";
  segment_plan: "all" | "free" | "paid";
  status: "draft" | "sending" | "sent" | "failed";
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sent_at: string | null;
}

const ROLE_OPTIONS = ["All members", "Buyers only", "Sellers only"] as const;
const PLAN_OPTIONS = ["All (free + paid)", "Free members only", "Paid members only"] as const;

function roleToValue(label: string): "all" | "buyer" | "seller" {
  if (label === "Buyers only") return "buyer";
  if (label === "Sellers only") return "seller";
  return "all";
}
function planToValue(label: string): "all" | "free" | "paid" {
  if (label === "Free members only") return "free";
  if (label === "Paid members only") return "paid";
  return "all";
}

export default function AdminCampaignsPage() {
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [roleLabel, setRoleLabel] = useState<(typeof ROLE_OPTIONS)[number]>("All members");
  const [planLabel, setPlanLabel] = useState<(typeof PLAN_OPTIONS)[number]>("All (free + paid)");

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const segmentRole = roleToValue(roleLabel);
  const segmentPlan = planToValue(planLabel);

  async function loadHistory() {
    const res = await fetch("/api/admin/campaigns");
    const body = await res.json();
    if (res.ok) setCampaigns(body.campaigns ?? []);
  }

  useEffect(() => {
    loadHistory();
  }, []);

  // Recount the audience whenever the segment changes, so the admin sees
  // "reaches ~N users" before committing to a send.
  useEffect(() => {
    setPreviewCount(null);
  }, [segmentRole, segmentPlan]);

  async function handlePreview() {
    setPreviewing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject || "(preview)",
          html_body: htmlBody || "(preview)",
          segment_role: segmentRole,
          segment_plan: segmentPlan,
          preview_only: true,
        }),
      });
      const body = await res.json();
      if (res.ok) setPreviewCount(body.recipientCount);
      else setMessage(body.error ?? "Could not preview segment.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSend() {
    if (!subject.trim() || !htmlBody.trim()) {
      setMessage("Subject and message body are required.");
      return;
    }
    if (!confirm(`This will email ${previewCount ?? "the matching"} users. Send now?`)) return;

    setSending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          html_body: htmlBody,
          segment_role: segmentRole,
          segment_plan: segmentPlan,
        }),
      });
      const body = await res.json();
      if (res.ok) {
        setMessage(`Sent to ${body.sent} of ${body.total} users (${body.failed} failed).`);
        setSubject("");
        setHtmlBody("");
        setPreviewCount(null);
        loadHistory();
      } else {
        setMessage(body.error ?? "Could not send campaign.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-medium">Email campaigns</h1>
      <p className="mb-6 text-sm text-muted">
        Send an offer or announcement to a segment of your users — split by free vs. paid, and buyer vs. seller.
      </p>

      <div className="max-w-2xl space-y-4 rounded-chip border border-line bg-white p-5">
        <Field
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. 20% off your next order — this weekend only"
        />

        <div>
          <label className="mb-1 block text-sm text-muted">Message (HTML allowed)</label>
          <textarea
            value={htmlBody}
            onChange={(e) => setHtmlBody(e.target.value)}
            rows={10}
            placeholder="<p>Hi there,</p><p>...</p>"
            className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
          <p className="mt-1 text-xs text-muted">
            Sent via your configured Resend account (RESEND_API_KEY / EMAIL_FROM).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Audience"
            options={ROLE_OPTIONS as unknown as string[]}
            value={roleLabel}
            onChange={(e) => setRoleLabel(e.target.value as (typeof ROLE_OPTIONS)[number])}
          />
          <SelectField
            label="Plan"
            options={PLAN_OPTIONS as unknown as string[]}
            value={planLabel}
            onChange={(e) => setPlanLabel(e.target.value as (typeof PLAN_OPTIONS)[number])}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={handlePreview} disabled={previewing}>
            {previewing ? "Checking…" : "Preview audience size"}
          </Button>
          {previewCount !== null && (
            <span className="text-sm text-muted">
              Reaches <strong className="text-ink">{previewCount}</strong> users
            </span>
          )}
        </div>

        {message && <p className="text-sm text-brand-violet">{message}</p>}

        <Button type="button" onClick={handleSend} disabled={sending} className="w-full">
          {sending ? "Sending…" : "Send campaign"}
        </Button>
      </div>

      <h2 className="mb-3 mt-10 font-display text-lg font-medium">History</h2>
      <div className="space-y-2">
        {campaigns.length === 0 && <p className="text-sm text-muted">No campaigns sent yet.</p>}
        {campaigns.map((c) => (
          <div key={c.id} className="rounded-chip border border-line bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{c.subject}</span>
              <span className="text-xs text-muted">
                {c.status === "sent"
                  ? `Sent ${new Date(c.sent_at ?? c.created_at).toLocaleString()}`
                  : c.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {c.segment_role === "all" ? "All members" : c.segment_role === "buyer" ? "Buyers" : "Sellers"} ·{" "}
              {c.segment_plan === "all" ? "Free + paid" : c.segment_plan === "free" ? "Free only" : "Paid only"} ·{" "}
              {c.sent_count}/{c.total_recipients} delivered{c.failed_count > 0 ? `, ${c.failed_count} failed` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
