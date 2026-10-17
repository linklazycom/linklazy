import { z } from "zod";

const list = (maxItems: number, maxText: number) => z.union([z.array(z.string().max(300)).max(maxItems), z.string().max(maxText)]);

/** Request body for creating/updating a project. Deep validation happens in lib/projects/rules.ts. */
export const projectBodySchema = z.object({
  name: z.string().max(300).optional(),
  url: z.string().max(2048).optional(),
  description: z.string().max(5000).nullish(),
  niche: z.string().max(100).nullish(),
  country: z.string().max(10).nullish(),
  language: z.string().max(10).nullish(),
  keywords: list(600, 30_000).nullish(),
  competitors: list(60, 5_000).nullish(),
  notes: z.string().max(10_000).nullish(),
});
