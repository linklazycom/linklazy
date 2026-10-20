import { domainToASCII } from "node:url";

/**
 * Email address checks for the outreach contact list (Batch 16B-1). Pure.
 * Practical rather than perfect: it accepts what real mail systems deliver to and rejects what would
 * only produce bounces (bad syntax, reserved test domains, system mailboxes).
 */
const LOCAL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL_RE = /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/;
const TLD_RE = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

const RESERVED_DOMAINS = new Set(["example.com", "example.net", "example.org"]);
const RESERVED_TLDS = new Set(["example", "test", "invalid", "localhost", "local", "internal"]);

/** Mailboxes that must never be mailed (nobody reads them, and mailing abuse@ looks hostile). */
const SYSTEM_LOCALS = new Set(["noreply", "no-reply", "donotreply", "do-not-reply", "mailer-daemon", "postmaster", "abuse", "bounce", "bounces"]);
/** Shared mailboxes: allowed, but flagged because replies and unsubscribes there are less reliable. */
const ROLE_LOCALS = new Set(["info", "admin", "support", "sales", "contact", "hello", "office", "mail", "webmaster", "team", "enquiries", "inquiries", "marketing"]);

export type EmailResult = { ok: true; email: string; domain: string; isRole: boolean } | { ok: false; reason: string };

export function normalizeEmail(raw: unknown): EmailResult {
  if (typeof raw !== "string") return { ok: false, reason: "Missing email" };
  const s = raw
    .trim()
    .replace(/^mailto:/i, "")
    .replace(/^<|>$/g, "")
    .trim()
    .toLowerCase();
  if (!s) return { ok: false, reason: "Missing email" };
  if (s.length > 254) return { ok: false, reason: "Email is too long" };

  const at = s.indexOf("@");
  if (at <= 0 || at !== s.lastIndexOf("@")) return { ok: false, reason: "Not a valid email address" };
  const local = s.slice(0, at);
  if (local.length > 64 || !LOCAL_RE.test(local)) return { ok: false, reason: "Not a valid email address" };

  const domain = domainToASCII(s.slice(at + 1));
  if (!domain) return { ok: false, reason: "Not a valid email address" };
  const labels = domain.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL_RE.test(l))) return { ok: false, reason: "Not a valid email address" };
  const tld = labels[labels.length - 1];
  if (!TLD_RE.test(tld)) return { ok: false, reason: "Not a valid email address" };
  if (RESERVED_DOMAINS.has(domain) || RESERVED_TLDS.has(tld)) return { ok: false, reason: "Reserved or test domain" };
  if (SYSTEM_LOCALS.has(local)) return { ok: false, reason: "System mailbox (no-reply, abuse, postmaster…)" };

  return { ok: true, email: `${local}@${domain}`, domain, isRole: ROLE_LOCALS.has(local) };
}

/** j•••@example.com — enough for a person to recognise their own address on the unsubscribe page. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "•••";
  return `${email[0]}•••${email.slice(at)}`;
}
