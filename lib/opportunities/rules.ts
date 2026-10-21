import { cleanMultiline } from "@/lib/projects/rules";

/** Opportunity Finder rules (Batch 16). Pure. */
export const OPP_TYPES = [
  { id: "guest_post", label: "Guest post" },
  { id: "directory", label: "Directory" },
  { id: "profile", label: "Profile / community" },
  { id: "resource_page", label: "Resource page" },
  { id: "comment", label: "Blog comment" },
] as const;
export type OppType = (typeof OPP_TYPES)[number]["id"];
export const OPP_TYPE_IDS: readonly string[] = OPP_TYPES.map((t) => t.id);
export const isOppType = (v: unknown): v is OppType => typeof v === "string" && OPP_TYPE_IDS.includes(v);
export const oppTypeLabel = (id: string) => OPP_TYPES.find((t) => t.id === id)?.label ?? id;

export const OPP_STATUSES = ["new", "saved", "contacted", "done", "ignored"] as const;
export type OppStatus = (typeof OPP_STATUSES)[number];
export const isOppStatus = (v: unknown): v is OppStatus => typeof v === "string" && (OPP_STATUSES as readonly string[]).includes(v);
export const OPP_STATUS_LABELS: Record<OppStatus, string> = { new: "New", saved: "Saved", contacted: "Contacted", done: "Done", ignored: "Ignored" };

export const NOTE_MAX = 1000;
export const MAX_PER_PROJECT = 1000;
export const MAX_QUERIES_PER_RUN = 6;
export const RESULTS_PER_QUERY = 10;

/** Parses the types the user ticked: valid, unique, in the fixed order; null when none. */
export function parseTypes(input: unknown): OppType[] | null {
  if (!Array.isArray(input)) return null;
  const set = new Set(input.filter(isOppType));
  const out = OPP_TYPES.map((t) => t.id).filter((id) => set.has(id));
  return out.length > 0 ? out : null;
}

const TRACKING_PARAM = /^(utm_[a-z0-9_]+|gclid|fbclid|msclkid|mc_cid|mc_eid|igshid|ref|ref_src|_hsenc|_hsmi)$/i;

export interface NormalizedUrl {
  url: string;
  domain: string;
}

/**
 * One canonical form per page: http(s) only, lower-case host without "www.", no fragment, no tracking parameters,
 * remaining parameters sorted, no trailing slash (except the root). Returns null for anything that is not a public-looking web address.
 */
export function normalizeUrl(raw: string): NormalizedUrl | null {
  let u: URL;
  try {
    u = new URL(raw.trim().slice(0, 2048));
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (!host.includes(".") || host.length > 253 || host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":")) return null;
  u.hash = "";
  const keep = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAM.test(k)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  u.search = "";
  for (const [k, v] of keep) u.searchParams.append(k, v);
  let path = u.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  const port = u.port && !((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) ? `:${u.port}` : "";
  const qs = u.search;
  const url = `${u.protocol}//${host}${port}${path === "/" && !qs ? "" : path}${qs}`;
  if (url.length > 2048) return null;
  return { url, domain: host };
}

/** Host of a project competitor entry (a bare domain or a full address); null when unusable. */
export function hostOfEntry(entry: string): string | null {
  const s = entry.trim();
  if (!s) return null;
  return normalizeUrl(/^https?:\/\//i.test(s) ? s : `https://${s}`)?.domain ?? null;
}

/** Sites that are not outreach targets: search engines, big social networks, reference and shopping sites. */
const BLOCKED = [
  "google.com", "bing.com", "duckduckgo.com", "yahoo.com", "baidu.com", "yandex.com",
  "facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com", "tiktok.com", "pinterest.com", "youtube.com", "youtu.be",
  "wikipedia.org", "amazon.com", "ebay.com", "tavily.com",
];
export function isBlockedDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return BLOCKED.some((b) => d === b || d.endsWith(`.${b}`));
}

export type OppPatch = { status?: OppStatus; note?: string | null };
export type OppPatchResult = { ok: true; value: OppPatch } | { ok: false; message: string; field?: string };

export function validateOppPatch(input: Record<string, unknown>): OppPatchResult {
  const value: OppPatch = {};
  if (input.status !== undefined) {
    if (!isOppStatus(input.status)) return { ok: false, message: "Choose a valid status.", field: "status" };
    value.status = input.status;
  }
  if (input.note !== undefined) {
    if (input.note === null || (typeof input.note === "string" && !input.note.trim())) value.note = null;
    else value.note = cleanMultiline(input.note, NOTE_MAX, 20) || null;
  }
  if (value.status === undefined && value.note === undefined) return { ok: false, message: "Nothing to change." };
  return { ok: true, value };
}

export type Confidence = "likely" | "possible" | "unknown";
export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  likely: "Likely accepts submissions",
  possible: "Possibly accepts submissions",
  unknown: "Not confirmed",
};

// ---------------------------------------------------------------------------------------------------------------
// List filters (page + CSV export share them)
// ---------------------------------------------------------------------------------------------------------------
export const OPP_PER_PAGE = 25;
export const OPP_SORTS = ["score", "newest", "domain"] as const;
export type OppSort = (typeof OPP_SORTS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export interface OppFilters {
  project: string | null;
  type: OppType | null;
  /** null = everything except ignored; "all" = everything */
  status: OppStatus | "all" | null;
  minScore: number;
  sort: OppSort;
  page: number;
}

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseOppFilters(sp: Record<string, string | string[] | undefined>): OppFilters {
  const project = first(sp.project);
  const type = first(sp.type);
  const status = first(sp.status);
  const sort = first(sp.sort);
  const min = Math.floor(Number(first(sp.min)));
  const page = Math.floor(Number(first(sp.page)));
  return {
    project: isUuid(project) ? project : null,
    type: isOppType(type) ? type : null,
    status: status === "all" ? "all" : isOppStatus(status) ? status : null,
    minScore: Number.isFinite(min) ? Math.max(0, Math.min(100, min)) : 0,
    sort: (OPP_SORTS as readonly string[]).includes(sort) ? (sort as OppSort) : "score",
    page: Number.isFinite(page) ? Math.max(1, Math.min(10_000, page)) : 1,
  };
}

export const OPP_EXPORT_HEADERS = ["Project", "Type", "Score", "Confidence", "Status", "Domain", "URL", "Title", "Note", "Found"] as const;
