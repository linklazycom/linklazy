import { z } from "zod";

export const siteSubmissionSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .refine((v) => /^https?:\/\//.test(v), "Include http:// or https://"),
  niche: z.string().trim().min(2, "Niche is required"),
  language: z.string().trim().min(2).default("en"),

  da: z.coerce.number().int().min(0).max(100).optional(),
  pa: z.coerce.number().int().min(0).max(100).optional(),
  dr: z.coerce.number().int().min(0).max(100).optional(),
  organic_traffic: z.coerce.number().int().min(0).optional(),
  referring_domains: z.coerce.number().int().min(0).optional(),
  total_backlinks: z.coerce.number().int().min(0).optional(),
  indexed_pages: z.coerce.number().int().min(0).optional(),
  post_count: z.coerce.number().int().min(0).optional(),
  spam_score: z.coerce.number().min(0).max(100).optional(),

  accepts_exchange: z.boolean().default(true),
  accepts_paid: z.boolean().default(true),
  price_amount: z.coerce.number().int().min(0).optional(),
  link_type: z.enum(["dofollow", "nofollow"]).default("dofollow"),
  placement: z
    .enum(["in_content", "author_bio", "homepage", "sidebar"])
    .default("in_content"),
  turnaround_hours: z.coerce.number().int().min(1).default(48),
  guidelines: z.string().trim().max(2000).optional(),

  pay_per_view_enabled: z.boolean().default(false),
  view_price: z.coerce.number().int().min(50).max(500).optional(),
  access_duration_days: z.coerce.number().int().min(1).optional(), // omit/null = lifetime
});

export type SiteSubmissionInput = z.infer<typeof siteSubmissionSchema>;
