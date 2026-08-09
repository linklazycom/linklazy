import { z } from "zod";

export const proposeMatchSchema = z.object({
  site_a_id: z.string().uuid(), // my site
  site_b_id: z.string().uuid(), // the site I want to exchange with
  my_target_url: z.string().url(),
  my_anchor_text: z.string().trim().min(1).max(200),
  their_target_url: z.string().url(),
  their_anchor_text: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000).optional(),
});

export type ProposeMatchInput = z.infer<typeof proposeMatchSchema>;
