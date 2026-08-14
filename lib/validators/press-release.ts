import { z } from "zod";

export const createPressReleaseOrderSchema = z.object({
  product_ids: z.array(z.string().uuid()).min(1, "Choose at least one distribution or writing option"),
  quantity: z.coerce.number().int().min(1).max(25).default(1),
  headline: z.string().trim().min(5).max(180),
  website_url: z.string().url(),
  target_url: z.string().url(),
  summary: z.string().trim().min(30).max(2000),
  notes: z.string().trim().max(2000).optional(),
});

export type CreatePressReleaseOrderInput = z.infer<typeof createPressReleaseOrderSchema>;
