import { TICKET_KIND_LABELS, isTicketKind, type TicketKind } from "@/lib/outreach/reply";

/**
 * Reply alerts and the "Open in Saleshandy" link (Batch 23C).
 *  - A new reply emails the admin address (the site's contact email) unless the admin turned this off. Automatic answers
 *    ("out of office") are not announced. The email never blocks recording the reply.
 *  - Saleshandy's address format for one conversation was not checked against its documentation, so the link is a template the admin
 *    fills in once, from a real conversation address, with {conversation_id} (and/or {email}) where the changing part goes.
 * This file is the pure part (unit-tested); the sending lives in notify-server.ts.
 */
export const OUTREACH_NOTIFY_KEY = "outreach_notify_replies";
export const OUTREACH_INBOX_LINK_KEY = "outreach_inbox_link_template";
export const INBOX_TEMPLATE_MAX = 500;

/** A missing value means ON (a reply you never hear about is the worse mistake). */
export const isNotifyOn = (value: unknown): boolean => !(value === false || value === "false");

export type InboxTemplateResult = { ok: true; value: string } | { ok: false; message: string };

/** Empty clears the link. Otherwise: an https address with {conversation_id} and/or {email} in it, no spaces. */
export function validateInboxTemplate(input: unknown): InboxTemplateResult {
  if (input === null || input === undefined) return { ok: true, value: "" };
  if (typeof input !== "string") return { ok: false, message: "The link must be text." };
  const v = input.trim();
  if (!v) return { ok: true, value: "" };
  if (v.length > INBOX_TEMPLATE_MAX) return { ok: false, message: `The link is too long (most ${INBOX_TEMPLATE_MAX} characters).` };
  if (/\s|[\u0000-\u001f\u007f]/.test(v)) return { ok: false, message: "The link must not contain spaces." };
  if (!/^https:\/\//i.test(v)) return { ok: false, message: "The link must start with https://" };
  try {
    new URL(v.replace(/\{conversation_id\}|\{email\}/g, "x"));
  } catch {
    return { ok: false, message: "That is not a valid web address." };
  }
  if (!/\{conversation_id\}|\{email\}/.test(v)) return { ok: false, message: "Put {conversation_id} (or {email}) in the link where the changing part goes." };
  return { ok: true, value: v };
}

/** The link for one ticket, or null when there is no template or the ticket lacks what the template needs. */
export function buildInboxLink(template: string | null | undefined, ticket: { conversationId?: string | null; email?: string | null }): string | null {
  if (!template || !validateInboxTemplate(template).ok) return null;
  const needsConversation = template.includes("{conversation_id}");
  const needsEmail = template.includes("{email}");
  if (needsConversation && !ticket.conversationId) return null;
  if (needsEmail && !ticket.email) return null;
  return template
    .replace(/\{conversation_id\}/g, encodeURIComponent(ticket.conversationId ?? ""))
    .replace(/\{email\}/g, encodeURIComponent(ticket.email ?? ""));
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Pure: the alert the admin gets. The reply text is cut short and escaped; the full text is one click away. */
export function buildReplyNoticeEmail(input: { email: string; subject?: string | null; preview?: string | null; kind: TicketKind; ticketId: string; siteUrl: string }): { subject: string; html: string } {
  const who = escapeHtml(input.email);
  const note = input.kind === "no_thanks" ? "<p><strong>It looks like they asked you to stop or said no.</strong> Please check, and add them to the do-not-email list if so.</p>" : "";
  const preview = input.preview ? `<blockquote>${escapeHtml(input.preview.slice(0, 300))}</blockquote>` : "<p>(Saleshandy did not include the text.)</p>";
  const subj = input.subject ? `<p>Subject: ${escapeHtml(input.subject.slice(0, 150))}</p>` : "";
  return {
    subject: `New outreach reply from ${input.email}`.slice(0, 150),
    html: `<p><strong>${who}</strong> replied to your outreach email${input.kind !== "reply" && isTicketKind(input.kind) ? ` (${escapeHtml(TICKET_KIND_LABELS[input.kind])})` : ""}.</p>${subj}${preview}${note}<p><a href="${input.siteUrl}/admin/outreach/tickets/${encodeURIComponent(input.ticketId)}">Open the reply in admin</a></p>`,
  };
}
