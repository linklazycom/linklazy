import { z } from "zod";
import { shortUrlFor } from "@/lib/links/server";

/** Shared shapes for the public links API (Batch 11). */
export const createLinkSchema = z
  .object({
    destination_url: z.string().max(2048),
    slug: z.string().max(60).nullish(),
    title: z.string().max(300).nullish(),
    folder: z.string().max(100).nullish(),
    tags: z.union([z.array(z.string().max(60)).max(30), z.string().max(500)]).nullish(),
    expires_at: z.string().max(40).nullish(),
    max_clicks: z.number().int().nullish(),
    password: z.string().max(200).nullish(),
    is_active: z.boolean().optional(),
  })
  .strict();

export const updateLinkSchema = z
  .object({
    destination_url: z.string().max(2048).optional(),
    title: z.string().max(300).nullish(),
    folder: z.string().max(100).nullish(),
    tags: z.union([z.array(z.string().max(60)).max(30), z.string().max(500)]).nullish(),
    expires_at: z.string().max(40).nullish(),
    max_clicks: z.number().int().nullish(),
    password: z.string().max(200).nullish(),
    clear_password: z.boolean().optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

export const UUID = z.string().uuid();

/** What the API returns for a link: no user_id / internal columns, plus ready-made URLs. */
export function publicLink(row: Record<string, unknown>): Record<string, unknown> {
  const slug = String(row.slug);
  return {
    id: row.id,
    slug,
    short_url: shortUrlFor(slug),
    destination_url: row.destination_url,
    title: row.title ?? null,
    folder: row.folder ?? null,
    tags: row.tags ?? [],
    is_active: row.is_active,
    has_password: row.has_password,
    expires_at: row.expires_at ?? null,
    max_clicks: row.max_clicks ?? null,
    click_count: row.click_count ?? 0,
    last_clicked_at: row.last_clicked_at ?? null,
    disabled: row.disabled_reason ? true : false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function parsePaging(params: URLSearchParams): { page: number; perPage: number } {
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  const perPage = Math.max(1, Math.min(100, Number.parseInt(params.get("per_page") ?? "25", 10) || 25));
  return { page, perPage };
}
