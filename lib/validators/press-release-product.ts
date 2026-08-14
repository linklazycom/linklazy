import { z } from "zod";

export const pressReleaseProductSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).nullable().optional(),
  category: z.enum(["Premium News Media", "Top-tier News Media", "Writing Packages"]),
  price_amount: z.coerce.number().min(0).max(10000000),
  outlet_count: z.coerce.number().int().min(0).nullable().optional(),
  domain_authority: z.coerce.number().int().min(0).max(100).nullable().optional(),
  monthly_visitors: z.string().trim().max(50).nullable().optional(),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
});
