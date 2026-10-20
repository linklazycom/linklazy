import { CONTACT_SOURCE_IDS, CONTACT_STATUSES } from "@/lib/outreach/rules";

/** Contact-list filters from the page URL (Batch 16B-1). Only known values get through to the database query. */
export const CONTACTS_PER_PAGE = 50;

export interface ContactFilters {
  status: string | null;
  source: string | null;
  country: string | null;
  tag: string | null;
  q: string | null;
  page: number;
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseContactFilters(sp: Params): ContactFilters {
  const status = first(sp.status) ?? "";
  const source = first(sp.source) ?? "";
  const country = (first(sp.country) ?? "").trim().toUpperCase();
  const tag = (first(sp.tag) ?? "").trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").slice(0, 30);
  // Search text goes into a PostgREST "or" filter: keep only characters that cannot change its structure or act as wildcards.
  const q = (first(sp.q) ?? "").replace(/[^\p{L}\p{N}@.+\- ]/gu, "").replace(/\s+/g, " ").trim().slice(0, 80);
  const page = Math.max(1, Math.min(10_000, Math.floor(Number(first(sp.page))) || 1));
  return {
    status: (CONTACT_STATUSES as readonly string[]).includes(status) ? status : null,
    source: CONTACT_SOURCE_IDS.includes(source) ? source : null,
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    tag: tag || null,
    q: q.length >= 2 ? q : null,
    page,
  };
}

export function filtersToParams(f: ContactFilters): Record<string, string | undefined> {
  return { status: f.status ?? undefined, source: f.source ?? undefined, country: f.country ?? undefined, tag: f.tag ?? undefined, q: f.q ?? undefined };
}
