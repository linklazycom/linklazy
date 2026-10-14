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
