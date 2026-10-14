import { z } from "zod";
import { isHttpUrl } from "@/lib/match-flow";

const httpUrl = z.string().url().refine(isHttpUrl, "Only http(s) links are allowed");

export const proposeMatchSchema = z.object({
  site_a_id: z.string().uuid(), // my site
  site_b_id: z.string().uuid(), // the site I want to exchange with
  my_target_url: httpUrl,
  my_anchor_text: z.string().trim().min(1).max(200),
  their_target_url: httpUrl,
  their_anchor_text: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000).optional(),
});

export type ProposeMatchInput = z.infer<typeof proposeMatchSchema>;

export const counterTermsSchema = z.object({
  from_a: z.object({ target_url: httpUrl, anchor_text: z.string().trim().min(1).max(200) }),
  from_b: z.object({ target_url: httpUrl, anchor_text: z.string().trim().min(1).max(200) }),
  notes: z.string().trim().max(1000).optional(),
});
