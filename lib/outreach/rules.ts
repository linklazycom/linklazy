import { cleanLine, cleanMultiline } from "@/lib/projects/rules";

/** Outreach contact rules (Batch 16B-1): statuses, sources, field cleaning, edit validation. Pure. */
export const CONTACT_STATUSES = ["active", "held", "unsubscribed", "bounced", "complained", "blocked"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** Statuses an admin can set by hand. The others only ever come from the contact's own action or a mail event. */
export const MANUAL_STATUSES = ["active", "held", "blocked"] as const;
/** Statuses that can never be undone from the admin screen. */
export const FINAL_STATUSES: readonly string[] = ["unsubscribed", "bounced", "complained"];

export const CONTACT_SOURCES = [
  { id: "past_customers", label: "People who bought or used my services before" },
  { id: "opted_in", label: "People who asked to hear from me (signed up / opted in)" },
  { id: "public_business", label: "Business contact published on their own website for enquiries" },
  { id: "purchased_or_scraped", label: "Bought or collected from other places (needs review before sending)" },
  { id: "other", label: "Other" },
] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number]["id"];
export const CONTACT_SOURCE_IDS: readonly string[] = CONTACT_SOURCES.map((s) => s.id);
export const isContactSource = (v: unknown): v is ContactSource => typeof v === "string" && CONTACT_SOURCE_IDS.includes(v);

export const HOLD_REASONS = ["restricted_region", "source_review", "manual"] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];
export const isHoldReason = (v: unknown): v is HoldReason => typeof v === "string" && (HOLD_REASONS as readonly string[]).includes(v);

export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  restricted_region: "Region needs consent (EU/EEA, UK, Switzerland)",
  source_review: "List source needs review",
  manual: "Held by an admin",
};

export const SUPPRESSION_REASONS = ["unsubscribe", "bounce", "complaint", "manual"] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export const TAG_MAX = 10;
export const TAG_LEN = 30;

/** Lowercase tags of letters, digits, space, dash and underscore; no duplicates. */
export function cleanTags(input: unknown): string[] {
  const items = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,;\n]+/) : [];
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const t = item
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, TAG_LEN);
    if (t.length < 1 || out.includes(t)) continue;
    out.push(t);
    if (out.length >= TAG_MAX) break;
  }
  return out;
}

/** http(s) address with a dotted host, stored as origin + path. Anything else is dropped (null). */
export function cleanWebsite(v: unknown): string | null {
  const raw = cleanLine(v, 300);
  if (!raw) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname.includes(".") || u.username || u.password) return null;
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname === "/" ? "/" : u.pathname.replace(/\/+$/, "")}`.slice(0, 300);
  } catch {
    return null;
  }
}

export interface ContactPatch {
  full_name?: string | null;
  company?: string | null;
  website?: string | null;
  tags?: string[];
  notes?: string | null;
  status?: (typeof MANUAL_STATUSES)[number];
}

type Fail = { ok: false; message: string; field?: string };

/** Validates an admin edit. `currentStatus` blocks any change to a contact that unsubscribed, bounced or complained. */
export function validateContactPatch(input: Record<string, unknown>, currentStatus: string): { ok: true; value: ContactPatch } | Fail {
  const out: ContactPatch = {};
  if (input.full_name !== undefined) out.full_name = cleanLine(input.full_name, 100);
  if (input.company !== undefined) out.company = cleanLine(input.company, 120);
  if (input.website !== undefined) {
    const raw = typeof input.website === "string" ? input.website.trim() : "";
    const w = cleanWebsite(input.website);
    if (raw && !w) return { ok: false, message: "That website address is not valid.", field: "website" };
    out.website = w;
  }
  if (input.tags !== undefined) out.tags = cleanTags(input.tags);
  if (input.notes !== undefined) out.notes = cleanMultiline(input.notes, 1000, 20);
  if (input.status !== undefined) {
    if (FINAL_STATUSES.includes(currentStatus)) {
      return { ok: false, message: "This person unsubscribed, bounced or complained. That cannot be undone here.", field: "status" };
    }
    if (typeof input.status !== "string" || !(MANUAL_STATUSES as readonly string[]).includes(input.status)) {
      return { ok: false, message: "Invalid status.", field: "status" };
    }
    out.status = input.status as (typeof MANUAL_STATUSES)[number];
  }
  if (Object.keys(out).length === 0) return { ok: false, message: "Nothing to change." };
  return { ok: true, value: out };
}
