import { maskDomain } from "@/lib/mask-domain";

/** Pure rules for exchange proposals (no database access, easy to test). */
export const OPEN_MATCH_STATUSES = ["proposed", "countered"] as const;

export interface MatchForAccess {
  status: string;
  initiated_by: string | null;
}

export type ResponderCheck =
  | { ok: true; side: "a" | "b" }
  | { ok: false; status: number; error: string };

/**
 * Who may respond to a proposal, and when.
 *  - only an owner of one of the two sites
 *  - only while the proposal is still open (never re-accept / re-reject)
 *  - never the party who sent the latest offer (this also stops someone
 *    accepting their own counter-offer)
 */
export function checkResponder(
  match: MatchForAccess,
  userId: string,
  ownerAId: string,
  ownerBId: string
): ResponderCheck {
  const isA = ownerAId === userId;
  const isB = ownerBId === userId;
  if (!isA && !isB) return { ok: false, status: 403, error: "Not your proposal to respond to" };
  if (!(OPEN_MATCH_STATUSES as readonly string[]).includes(match.status)) {
    return { ok: false, status: 409, error: `This proposal is already ${match.status}.` };
  }
  if (match.initiated_by === userId) return { ok: false, status: 400, error: "Waiting on the other party" };
  return { ok: true, side: isA ? "a" : "b" };
}

/** Only http(s) links may be stored as link targets (blocks javascript:, data:, etc.). */
export function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Real domain for the site's owner and once the exchange is accepted; masked otherwise. */
export function domainForViewer(
  site: { owner_id: string; domain: string },
  viewerId: string,
  matchStatus: string
): string {
  if (site.owner_id === viewerId || matchStatus === "accepted") return site.domain;
  return maskDomain(site.domain);
}

// ---------------------------------------------------------------------------------------------------------------------
// Terms of a proposal (Batch 23A). from_a = the page on site A that site B's owner will link to; from_b = the page on
// site B that site A's owner will link to. The proposer only ever names a page on THEIR OWN site. The other owner names
// theirs when they accept or counter, so nobody has to guess (or already know) the other site's address, and a link
// target can never point at a third-party site.
// ---------------------------------------------------------------------------------------------------------------------
export interface MatchLink {
  target_url: string;
  anchor_text: string;
}
export interface MatchTerms {
  from_a: MatchLink;
  from_b?: MatchLink | null;
  notes?: string;
}

/** Lower-case host without a leading "www." and trailing dot; null when the value is not a parseable URL or host. */
export function normalizeHost(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`).hostname;
    return host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** True when the link's host is the site's listed domain or one of its subdomains. */
export function urlBelongsToDomain(url: string, domain: string): boolean {
  const host = normalizeHost(url);
  const site = normalizeHost(domain);
  if (!host || !site) return false;
  return host === site || host.endsWith(`.${site}`);
}

/** A link address with its host masked ("https://ex****.com/page"); used until the exchange is accepted. */
export function maskUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${maskDomain(u.hostname.replace(/^www\./, ""))}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return "****";
  }
}

type SiteRef = { owner_id: string; domain: string };

/**
 * The terms as one viewer may see them: before acceptance, the OTHER owner's page address is masked, exactly like their
 * domain. The viewer always sees their own page in full.
 */
export function termsForViewer(terms: MatchTerms | null | undefined, siteA: SiteRef, siteB: SiteRef, viewerId: string, status: string): MatchTerms | null {
  if (!terms) return null;
  const reveal = status === "accepted";
  const view = (link: MatchLink | null | undefined, site: SiteRef): MatchLink | null =>
    link ? { ...link, target_url: reveal || site.owner_id === viewerId ? link.target_url : maskUrl(link.target_url) } : null;
  return { from_a: view(terms.from_a, siteA) as MatchLink, from_b: view(terms.from_b, siteB), ...(terms.notes ? { notes: terms.notes } : {}) };
}

export function buildProposedTerms(input: { my_target_url: string; my_anchor_text: string; notes?: string }): MatchTerms {
  return { from_a: { target_url: input.my_target_url, anchor_text: input.my_anchor_text }, ...(input.notes ? { notes: input.notes } : {}) };
}

export type TermsResult = { ok: true; terms: MatchTerms; filled?: boolean } | { ok: false; error: string };

const OWN_PAGE_ERROR = "The page must be on your own listed site.";

export interface CounterInput {
  own_target_url: string;
  own_anchor_text: string;
  other_anchor_text: string;
  notes?: string;
}

/**
 * A counter-offer. The responder (who owns site `side`) may change the page on THEIR site and both anchor texts. The other
 * owner's page address is carried over untouched, so it can never be edited by the wrong person.
 */
export function applyCounter(current: MatchTerms, side: "a" | "b", input: CounterInput, ownDomain: string): TermsResult {
  if (!urlBelongsToDomain(input.own_target_url, ownDomain)) return { ok: false, error: OWN_PAGE_ERROR };
  const own: "from_a" | "from_b" = side === "a" ? "from_a" : "from_b";
  const other: "from_a" | "from_b" = side === "a" ? "from_b" : "from_a";
  const theirs = current[other];
  if (!theirs) return { ok: false, error: "The other party's page is missing from this proposal." };
  const notes = input.notes ?? current.notes;
  const terms: MatchTerms = {
    from_a: current.from_a,
    from_b: current.from_b ?? null,
    ...(notes ? { notes } : {}),
  };
  terms[own] = { target_url: input.own_target_url, anchor_text: input.own_anchor_text };
  terms[other] = { target_url: theirs.target_url, anchor_text: input.other_anchor_text };
  return { ok: true, terms };
}

/**
 * The final terms at acceptance. A complete proposal (both pages named: a counter-offer, or an older proposal) is accepted as
 * it stands. A first proposal names only the proposer's page, so the accepting owner must name theirs; it has to be on their
 * own site.
 */
export function resolveAcceptTerms(current: MatchTerms, side: "a" | "b", pick: MatchLink | undefined, ownDomain: string): TermsResult {
  if (current.from_a && current.from_b) return { ok: true, terms: current };
  const own: "from_a" | "from_b" = side === "a" ? "from_a" : "from_b";
  if (current[own]) return { ok: false, error: "This proposal is incomplete." };
  if (!pick) return { ok: false, error: "Choose the page on your site that should receive the link." };
  if (!urlBelongsToDomain(pick.target_url, ownDomain)) return { ok: false, error: OWN_PAGE_ERROR };
  return { ok: true, filled: true, terms: { ...current, [own]: { target_url: pick.target_url, anchor_text: pick.anchor_text } } as MatchTerms };
}
