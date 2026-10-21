import { cleanMultiline } from "@/lib/projects/rules";

/** Reply tickets and delivery numbers (Batch 16B-3). Pure. */
export const TICKET_STATUSES = ["new", "followup", "interested", "order", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const isTicketStatus = (v: unknown): v is TicketStatus => typeof v === "string" && (TICKET_STATUSES as readonly string[]).includes(v);

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  new: "New",
  followup: "Needs follow-up",
  interested: "Interested",
  order: "Order",
  closed: "Closed",
};

export const TICKET_KINDS = ["reply", "auto_reply", "no_thanks"] as const;
export type TicketKind = (typeof TICKET_KINDS)[number];
export const TICKET_KIND_LABELS: Record<TicketKind, string> = { reply: "Reply", auto_reply: "Automatic answer", no_thanks: "Asked to stop / not interested" };
export const isTicketKind = (v: unknown): v is TicketKind => typeof v === "string" && (TICKET_KINDS as readonly string[]).includes(v);

const AUTO_REPLY = [
  /out of (the )?office/i,
  /auto[- ]?reply/i,
  /automatic(ally generated)? (reply|response|answer)/i,
  /automated (reply|response|message)/i,
  /\b(i am|i'm|we are|we're) (currently )?(away|on (vacation|holiday|leave|annual leave|maternity leave))/i,
  /\bon (annual|maternity|paternity|sick) leave\b/i,
  /\bwill (be )?(back|return|respond|reply)\b.{0,40}\b(on|in|after|from)\b/i,
  /\bdo not reply to this (email|message)\b/i,
];
const NO_THANKS = [
  /\bunsubscribe\b/i,
  /\bremove me\b/i,
  /\btake me off\b/i,
  /\bstop (emailing|sending|contacting|messaging|writing)\b/i,
  /\bnot interested\b/i,
  /\bno,? thank(s| you)\b/i,
  /\bdo not (contact|email|message) me\b/i,
  /\bdon'?t (contact|email|message) me\b/i,
  /\bleave me alone\b/i,
  /\bnot looking (for|to)\b/i,
];

/**
 * Guesses what a reply is. A hint for the admin only: nothing is ever suppressed automatically from a guess.
 * Automatic answers are checked first because they often carry an "unsubscribe" line of their own.
 */
export function classifyReply(text: string | null | undefined): TicketKind {
  const t = (text ?? "").slice(0, 3000);
  if (!t.trim()) return "reply";
  if (AUTO_REPLY.some((re) => re.test(t))) return "auto_reply";
  if (NO_THANKS.some((re) => re.test(t))) return "no_thanks";
  return "reply";
}

export const NOTE_MAX = 2000;

export type TicketPatch = { status?: TicketStatus; note?: string };
export type TicketPatchResult = { ok: true; value: TicketPatch } | { ok: false; message: string; field?: string };

export function validateTicketPatch(input: Record<string, unknown>): TicketPatchResult {
  const value: TicketPatch = {};
  if (input.status !== undefined) {
    if (!isTicketStatus(input.status)) return { ok: false, message: "Choose a valid status.", field: "status" };
    value.status = input.status;
  }
  if (input.note !== undefined) {
    const note = cleanMultiline(input.note, NOTE_MAX, 40);
    if (!note) return { ok: false, message: "The note is empty.", field: "note" };
    value.note = note;
  }
  if (value.status === undefined && value.note === undefined) return { ok: false, message: "Nothing to change." };
  return { ok: true, value };
}

/** Percentage with one decimal, "—" when there is nothing to divide by. */
export function pct(part: number, whole: number): string {
  if (!whole || whole <= 0) return "—";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export interface DeliveryRow {
  campaign_id: string | null;
  campaign_name: string;
  total: number;
  queued: number;
  push_failed: number;
  handed_over: number;
  sent: number;
  bounced: number;
  replied: number;
  unsubscribed: number;
  opened: number;
  clicked: number;
  stuck: number;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** The database returns bigint counts as numbers or strings; this makes them plain numbers. */
export function toDeliveryRow(r: Record<string, unknown>): DeliveryRow {
  return {
    campaign_id: typeof r.campaign_id === "string" ? r.campaign_id : null,
    campaign_name: typeof r.campaign_name === "string" ? r.campaign_name : "(unknown)",
    total: num(r.total),
    queued: num(r.queued),
    push_failed: num(r.push_failed),
    handed_over: num(r.handed_over),
    sent: num(r.sent),
    bounced: num(r.bounced),
    replied: num(r.replied),
    unsubscribed: num(r.unsubscribed),
    opened: num(r.opened),
    clicked: num(r.clicked),
    stuck: num(r.stuck),
  };
}

export function sumDelivery(rows: DeliveryRow[]): DeliveryRow {
  const t: DeliveryRow = { campaign_id: null, campaign_name: "All campaigns", total: 0, queued: 0, push_failed: 0, handed_over: 0, sent: 0, bounced: 0, replied: 0, unsubscribed: 0, opened: 0, clicked: 0, stuck: 0 };
  for (const r of rows) for (const k of ["total", "queued", "push_failed", "handed_over", "sent", "bounced", "replied", "unsubscribed", "opened", "clicked", "stuck"] as const) t[k] += r[k];
  return t;
}

export type HealthLevel = "ok" | "warn" | "bad";
export interface HealthNote {
  level: HealthLevel;
  text: string;
}

/** Plain-language findings on whether mail is really flowing. Bounce limit matches the auto-pause rule (3%). */
export function deliveryHealth(t: DeliveryRow, ctx: { lastEventAt: string | null; pushEnabled: boolean }): HealthNote[] {
  const out: HealthNote[] = [];
  if (t.total === 0) return [{ level: "warn", text: "Nothing has been handed to Saleshandy in this period yet." }];
  if (t.push_failed > 0) out.push({ level: "bad", text: `${t.push_failed} contact(s) could not be handed to Saleshandy. See the failed list below for the reason; Send now retries them (3 attempts at most).` });
  if (t.stuck > 0) out.push({ level: "bad", text: `${t.stuck} contact(s) were handed over more than 2 days ago but Saleshandy never confirmed sending. Check the sequence is active, the mailboxes are connected, and the webhook address is saved in Saleshandy.` });
  if (t.handed_over > 0 && t.sent === 0 && !ctx.lastEventAt) out.push({ level: "warn", text: "No webhook event has ever arrived. Until one does, the sent / opened / bounced numbers below stay at zero even if emails are going out." });
  if (t.sent >= 30 && t.bounced / t.sent > 0.03) out.push({ level: "bad", text: `Bounce rate ${pct(t.bounced, t.sent)} is above 3%. Campaigns pause themselves at that level; check the list quality.` });
  else if (t.sent >= 10 && t.bounced / t.sent > 0.02) out.push({ level: "warn", text: `Bounce rate ${pct(t.bounced, t.sent)} is above 2%. Do not raise the daily limit yet.` });
  if (out.length === 0) out.push({ level: "ok", text: "No problems found: hand-overs succeeded, sending was confirmed and the bounce rate is low." });
  if (!ctx.pushEnabled) out.push({ level: "warn", text: "The master Sending switch is OFF, so nothing new will be handed over until you turn it on." });
  return out;
}
