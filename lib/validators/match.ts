import { z } from "zod";
import { isHttpUrl } from "@/lib/match-flow";

const httpUrl = z.string().url().refine(isHttpUrl, "Only http(s) links are allowed");
const anchor = z.string().trim().min(1).max(200);

/**
 * A first proposal names only a page on the proposer's OWN site (and the anchor text of the link they ask for). The other owner
 * chooses which of their pages receives the return link when they accept or counter (Batch 23A).
 */
export const proposeMatchSchema = z.object({
  site_a_id: z.string().uuid(), // my site
  site_b_id: z.string().uuid(), // the site I want to exchange with
  my_target_url: httpUrl,
  my_anchor_text: anchor,
  notes: z.string().trim().max(1000).optional(),
});

export type ProposeMatchInput = z.infer<typeof proposeMatchSchema>;

/** A counter-offer: the responder's own page + both anchor texts. The other owner's page is never sent by the browser. */
export const counterSchema = z.object({
  own_target_url: httpUrl,
  own_anchor_text: anchor,
  other_anchor_text: anchor,
  notes: z.string().trim().max(1000).optional(),
});

/** What the accepting owner picks when the proposal does not yet name a page on their site. */
export const acceptTermsSchema = z.object({ target_url: httpUrl, anchor_text: anchor });
