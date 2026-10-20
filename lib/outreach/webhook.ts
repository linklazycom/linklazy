/**
 * Saleshandy webhook events (Batch 16B-2). Pure. Event names and field names follow Saleshandy's "Example Webhook Data".
 * Saleshandy does not document a signature, so the endpoint is protected by a long random secret in its URL (checked in the route).
 */
export const WEBHOOK_EVENTS = [
  "email-sent",
  "email-opened",
  "email-link-clicked",
  "reply-received",
  "email-bounced",
  "prospect-unsubscribed",
  "prospect-finished",
  "prospect-outcome-updated",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const SEND_STATUSES = ["queued", "push_failed", "pushed", "sent", "finished", "replied", "unsubscribed", "bounced"] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

/** Higher wins: a late "sent" webhook can never overwrite "replied", and a bounce is final. */
const RANK: Record<SendStatus, number> = { queued: 0, push_failed: 1, pushed: 2, sent: 3, finished: 4, replied: 5, unsubscribed: 6, bounced: 7 };
export const canMoveSendStatus = (from: string, to: SendStatus): boolean => (RANK[from as SendStatus] ?? -1) < RANK[to];

export interface EventEffect {
  sendStatus: SendStatus | null;
  suppression: "bounce" | "unsubscribe" | null;
}

export function eventEffect(event: WebhookEvent): EventEffect {
  switch (event) {
    case "email-sent":
      return { sendStatus: "sent", suppression: null };
    case "reply-received":
      return { sendStatus: "replied", suppression: null };
    case "email-bounced":
      return { sendStatus: "bounced", suppression: "bounce" };
    case "prospect-unsubscribed":
      return { sendStatus: "unsubscribed", suppression: "unsubscribe" };
    case "prospect-finished":
      return { sendStatus: "finished", suppression: null };
    default:
      return { sendStatus: null, suppression: null }; // opened / clicked / outcome: recorded only
  }
}

export interface ParsedWebhook {
  event: WebhookEvent;
  email: string;
  occurredAt: string | null;
  sequenceId: string | null;
  stepId: string | null;
  detail: Record<string, string | number | boolean | null>;
  dedupeKey: string;
}

const TIME_FIELD: Record<WebhookEvent, string> = {
  "email-sent": "emailSentAt",
  "email-opened": "emailOpenedAt",
  "email-link-clicked": "linkClickedAt",
  "reply-received": "replyReceiveAt",
  "email-bounced": "emailBouncedAt",
  "prospect-unsubscribed": "prospectUnsubscribedAt",
  "prospect-finished": "prospectFinishedAt",
  "prospect-outcome-updated": "outcomeChangedAt",
};

const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const str = (v: unknown, max: number): string | null => {
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  return s ? s.slice(0, max) : null;
};
const isoOrNull = (v: unknown): string | null => {
  const s = str(v, 40);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;

export function parseWebhook(body: unknown): { ok: true; value: ParsedWebhook } | { ok: false; reason: string } {
  const b = rec(body);
  if (!b) return { ok: false, reason: "not an object" };
  const event = b.event;
  if (typeof event !== "string" || !(WEBHOOK_EVENTS as readonly string[]).includes(event)) return { ok: false, reason: "unknown event" };
  const ev = event as WebhookEvent;

  const prospect = rec(b.prospect);
  const email = str(prospect?.email, 254)?.toLowerCase() ?? null;
  if (!email || !EMAIL_RE.test(email)) return { ok: false, reason: "no prospect email" };

  const seq = rec(b.sequence);
  const sequenceId = str(seq?.id, 60);
  const stepId = str(seq?.stepID ?? seq?.stepId, 60);
  const occurredAt = isoOrNull(b[TIME_FIELD[ev]]);

  const detail: ParsedWebhook["detail"] = {};
  const set = (k: string, v: string | number | boolean | null) => {
    if (v !== null) detail[k] = v;
  };
  set("sequence_name", str(seq?.sequenceName, 120));
  set("step_number", str(seq?.stepNumber, 10));
  set("subject", str(seq?.emailSubject, 200));
  if (ev === "reply-received") {
    set("reply", str(b.receivedReplyMessage, 5000));
    set("conversation_id", str(b.conversationId, 60));
  }
  if (ev === "email-bounced") set("bounce_reason", str(b.bounceReason, 1000));
  if (ev === "email-opened") set("open_count", str(b.openCount, 10));
  if (ev === "email-link-clicked") {
    set("click_count", str(b.clickCount, 10));
    set("link", str(b.link, 300));
  }
  if (ev === "prospect-outcome-updated") {
    set("new_outcome", str(b.newOutcome, 60));
    set("old_outcome", str(b.oldOutcome, 60));
  }

  const counter = detail.open_count ?? detail.click_count ?? "";
  const dedupeKey = [ev, email, occurredAt ?? "", sequenceId ?? "", stepId ?? "", counter, detail.link ?? "", detail.new_outcome ?? ""].join("|").slice(0, 400);
  return { ok: true, value: { event: ev, email, occurredAt, sequenceId, stepId, detail, dedupeKey } };
}
