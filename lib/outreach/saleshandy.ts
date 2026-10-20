/**
 * Saleshandy connector (Batch 16B-2): request building and response reading. Pure (no network, no imports).
 * Only calls documented by Saleshandy are used:
 *   GET  https://open-api.saleshandy.com/v1/sequences        (list sequences; header x-api-key)
 *   POST https://open-api.saleshandy.com/v1/prospects/import (body: prospectList[{fields:[{id,value}]}], stepId,
 *                                                             verifyProspects, conflictAction)
 * Field and step ids are copied by the admin from Saleshandy (Settings > Prospect Fields; the sequence step), exactly
 * as Saleshandy's own import guide describes.
 */
export const SALESHANDY_BASE = "https://open-api.saleshandy.com/v1";

export const FIELD_KEYS = ["email", "first_name", "last_name", "company", "website", "listing_name", "listing_price", "listing_url", "listing_metrics"] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];
export type FieldMap = Partial<Record<FieldKey, string>>;

export interface FieldDef {
  key: FieldKey;
  label: string;
  required: boolean;
  /** Name to give a custom prospect field in Saleshandy (merge tag = {{<name>}}). System fields keep Saleshandy's own name. */
  saleshandyName: string;
  custom: boolean;
}

export const FIELD_DEFS: FieldDef[] = [
  { key: "email", label: "Email", required: true, saleshandyName: "Email", custom: false },
  { key: "first_name", label: "First Name", required: false, saleshandyName: "First Name", custom: false },
  { key: "last_name", label: "Last Name", required: false, saleshandyName: "Last Name", custom: false },
  { key: "company", label: "Company", required: false, saleshandyName: "Company", custom: false },
  { key: "website", label: "Website", required: false, saleshandyName: "Website", custom: false },
  { key: "listing_name", label: "Listing Name", required: false, saleshandyName: "Listing Name", custom: true },
  { key: "listing_price", label: "Listing Price", required: false, saleshandyName: "Listing Price", custom: true },
  { key: "listing_url", label: "Listing URL", required: false, saleshandyName: "Listing URL", custom: true },
  { key: "listing_metrics", label: "Listing Metrics", required: false, saleshandyName: "Listing Metrics", custom: true },
];

const FIELD_ID_RE = /^[A-Za-z0-9_-]{4,60}$/;
export const isSaleshandyId = (v: unknown): v is string => typeof v === "string" && FIELD_ID_RE.test(v);

export function validateFieldMap(input: unknown): { ok: true; value: FieldMap } | { ok: false; message: string; field?: string } {
  if (!input || typeof input !== "object") return { ok: false, message: "Invalid field list." };
  const src = input as Record<string, unknown>;
  const out: FieldMap = {};
  for (const def of FIELD_DEFS) {
    const raw = typeof src[def.key] === "string" ? (src[def.key] as string).trim() : "";
    if (!raw) {
      if (def.required) return { ok: false, message: `The ${def.label} field id is required.`, field: def.key };
      continue;
    }
    if (!isSaleshandyId(raw)) return { ok: false, message: `${def.label}: the id should be 4-60 letters or digits, copied from Saleshandy.`, field: def.key };
    out[def.key] = raw;
  }
  return { ok: true, value: out };
}

export interface PushRow {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  website?: string | null;
  listingName?: string | null;
  listingPrice?: string | null;
  listingUrl?: string | null;
  listingMetrics?: string | null;
}

const VALUE_MAX = 500;
const clip = (v: string | null | undefined) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, VALUE_MAX) : "");

export interface ImportPayload {
  prospectList: { fields: { id: string; value: string }[] }[];
  stepId: string;
  verifyProspects: false;
  conflictAction: "overwrite";
}

/** Builds the body for POST /prospects/import. Fields without a mapped id or without a value are left out. */
export function buildImportPayload(input: { stepId: string; rows: PushRow[]; fieldMap: FieldMap }): ImportPayload {
  const { fieldMap } = input;
  const prospectList = input.rows.map((r) => {
    const values: [FieldKey, string][] = [
      ["email", clip(r.email)],
      ["first_name", clip(r.firstName)],
      ["last_name", clip(r.lastName)],
      ["company", clip(r.company)],
      ["website", clip(r.website)],
      ["listing_name", clip(r.listingName)],
      ["listing_price", clip(r.listingPrice)],
      ["listing_url", clip(r.listingUrl)],
      ["listing_metrics", clip(r.listingMetrics)],
    ];
    const fields: { id: string; value: string }[] = [];
    for (const [key, value] of values) {
      const id = fieldMap[key];
      if (id && value) fields.push({ id, value });
    }
    return { fields };
  });
  // "overwrite": if the address is already a prospect in Saleshandy it is updated, not duplicated.
  return { prospectList, stepId: input.stepId, verifyProspects: false, conflictAction: "overwrite" };
}

const asRecord = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Reads the sequence list. The exact envelope is not documented in one place, so a few shapes are accepted. */
export function parseSequences(json: unknown): { id: string; name: string }[] {
  const root = asRecord(json);
  if (!root) return Array.isArray(json) ? pick(json) : [];
  const payload = asRecord(root.payload);
  const candidates: unknown[] = [root.sequences, payload?.sequences, payload?.data, root.data, root.payload, payload?.rows];
  for (const c of candidates) if (Array.isArray(c)) return pick(c);
  return [];
}

function pick(items: unknown[]): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (const it of items) {
    const o = asRecord(it);
    if (!o) continue;
    const id = o.id ?? o.sequenceId ?? o._id;
    const name = o.name ?? o.sequenceName ?? o.title;
    if ((typeof id === "string" || typeof id === "number") && typeof name === "string" && name.trim()) out.push({ id: String(id), name: name.trim().slice(0, 120) });
  }
  return out;
}

export interface ImportResult {
  ok: boolean;
  requestRef: string | null;
  message: string;
}

/** Interprets the reply to /prospects/import. Success means "Saleshandy accepted the import"; delivery is confirmed later by webhooks. */
export function parseImportResponse(status: number, json: unknown): ImportResult {
  const root = asRecord(json);
  const payload = asRecord(root?.payload);
  const text = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : "");
  const message = text(root?.message) || text(payload?.message) || text(root?.error) || "";
  if (status < 200 || status >= 300) return { ok: false, requestRef: null, message: message || `Saleshandy answered HTTP ${status}.` };
  if (root && (root.error === true || root.success === false || root.status === "error")) return { ok: false, requestRef: null, message: message || "Saleshandy refused the import." };
  const ref = payload?.requestId ?? root?.requestId ?? payload?.id ?? root?.id ?? null;
  return { ok: true, requestRef: typeof ref === "string" || typeof ref === "number" ? String(ref).slice(0, 80) : null, message: message || "Accepted" };
}
