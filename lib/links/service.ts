import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateSlug, generateSlug } from "@/lib/links/slug";
import { validateDestinationUrl } from "@/lib/links/url";
import { cleanText, cleanTags, parseExpiry, TITLE_MAX, FOLDER_MAX } from "@/lib/links/fields";
import { effectiveCaps } from "@/lib/links/limits";
import { hashLinkPassword, PASSWORD_MIN, PASSWORD_MAX } from "@/lib/links/password";
import { getLinkBlocklist, getLinkLimits, ownHosts } from "@/lib/links/server";
import type { ImportRow } from "@/lib/links/csv";

/** Create / update / import logic for short links (Batch 9). Always uses the service client AFTER the caller proved who the user is. */
export const LINK_COLUMNS =
  "id, user_id, slug, destination_url, title, folder, tags, is_active, has_password, expires_at, max_clicks, click_count, last_clicked_at, disabled_reason, created_at, updated_at";

export interface LinkInput {
  destination_url?: string;
  slug?: string | null;
  title?: string | null;
  folder?: string | null;
  tags?: unknown;
  expires_at?: string | null;
  max_clicks?: number | null;
  password?: string | null;
  is_active?: boolean;
  clear_password?: boolean;
}

export interface UserCtx {
  userId: string;
  isAdmin: boolean;
  createdAt: string | null;
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; field?: string };

const fail = (status: number, error: string, field?: string): { ok: false; status: number; error: string; field?: string } => ({
  ok: false,
  status,
  error,
  field,
});

interface Cleaned {
  destination_url: string;
  title: string | null;
  folder: string | null;
  tags: string[];
  expires_at: string | null;
  max_clicks: number | null;
}

async function cleanShared(input: LinkInput, partial: boolean): Promise<{ ok: true; patch: Partial<Cleaned> } | ReturnType<typeof fail>> {
  const patch: Partial<Cleaned> = {};
  if (!partial || input.destination_url !== undefined) {
    const blocklist = await getLinkBlocklist();
    const v = validateDestinationUrl(input.destination_url ?? "", { ownHosts: ownHosts(), blockedDomains: blocklist.domains });
    if (!v.ok) return fail(400, v.message, "destination_url");
    patch.destination_url = v.url;
  }
  if (!partial || input.title !== undefined) patch.title = cleanText(input.title, TITLE_MAX);
  if (!partial || input.folder !== undefined) patch.folder = cleanText(input.folder, FOLDER_MAX);
  if (!partial || input.tags !== undefined) patch.tags = cleanTags(input.tags);
  if (!partial || input.expires_at !== undefined) {
    const e = parseExpiry(input.expires_at);
    if (e === "invalid") return fail(400, "Enter a valid expiry date.", "expires_at");
    if (e === "past") return fail(400, "The expiry date must be in the future.", "expires_at");
    patch.expires_at = e;
  }
  if (!partial || input.max_clicks !== undefined) {
    const m = input.max_clicks ?? null;
    if (m !== null && (!Number.isInteger(m) || m < 1 || m > 1_000_000_000)) return fail(400, "Click limit must be a whole number of 1 or more.", "max_clicks");
    patch.max_clicks = m;
  }
  return { ok: true, patch };
}

function checkPassword(pw: string | null | undefined): ReturnType<typeof fail> | null {
  if (pw === undefined || pw === null || pw === "") return null;
  if (pw.length < PASSWORD_MIN) return fail(400, `Password must be at least ${PASSWORD_MIN} characters.`, "password");
  if (pw.length > PASSWORD_MAX) return fail(400, `Password must be at most ${PASSWORD_MAX} characters.`, "password");
  return null;
}

export async function createShortLink(
  ctx: UserCtx,
  input: LinkInput,
  opts: { skipRateLimit?: boolean } = {}
): Promise<ServiceResult<Record<string, unknown>>> {
  const cleaned = await cleanShared(input, false);
  if (!cleaned.ok) return cleaned;
  const pwErr = checkPassword(input.password);
  if (pwErr) return pwErr;

  const blocklist = await getLinkBlocklist();
  let customSlug: string | null = null;
  if (input.slug && input.slug.trim()) {
    const s = validateSlug(input.slug);
    if (!s.ok) return fail(400, s.message, "slug");
    if (blocklist.slugs.includes(s.slug)) return fail(400, "That slug is not allowed.", "slug");
    customSlug = s.slug;
  }

  const svc = createServiceClient();

  if (!ctx.isAdmin) {
    const limits = await getLinkLimits();
    const caps = effectiveCaps(limits, ctx.createdAt);
    const { count } = await svc.from("short_links").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId);
    if ((count ?? 0) >= caps.maxLinks) {
      return fail(
        403,
        caps.isNewAccount
          ? `New accounts can create up to ${caps.maxLinks} links for now. Delete a link or try again later.`
          : `You've reached your limit of ${caps.maxLinks} links.`
      );
    }
    if (!opts.skipRateLimit) {
      const { allowed } = await checkRateLimit("link_create", ctx.userId, { max: caps.perHour, windowMinutes: 60 });
      if (!allowed) return fail(429, "You're creating links too fast. Please try again in a while.");
    }
  }

  const password = input.password ? input.password : null;
  const base = {
    user_id: ctx.userId,
    ...cleaned.patch,
    has_password: !!password,
    is_active: input.is_active ?? true,
  };

  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = customSlug ?? generateSlug(attempt < 3 ? 7 : 8);
    if (!customSlug && blocklist.slugs.includes(slug)) continue;
    const { data, error } = await svc.from("short_links").insert({ ...base, slug }).select(LINK_COLUMNS).single();
    if (!error && data) {
      if (password) {
        const { error: pwError } = await svc.from("short_link_secrets").insert({ link_id: data.id, password_hash: hashLinkPassword(password) });
        if (pwError) {
          await svc.from("short_links").delete().eq("id", data.id);
          return fail(500, "Could not save the password. Please try again.");
        }
      }
      return { ok: true, data };
    }
    if (error?.code === "23505") {
      if (customSlug) return fail(409, "That slug is already taken.", "slug");
      continue; // random collision, try another
    }
    return fail(500, "Could not create the link. Please try again.");
  }
  return fail(500, "Could not generate a free slug. Please try again.");
}

export async function updateShortLink(
  ctx: UserCtx,
  id: string,
  input: LinkInput
): Promise<ServiceResult<Record<string, unknown>>> {
  const svc = createServiceClient();
  const { data: existing } = await svc.from("short_links").select("id, user_id").eq("id", id).maybeSingle();
  // Same answer for "missing" and "someone else's" so ids can't be probed.
  if (!existing || existing.user_id !== ctx.userId) return fail(404, "Link not found.");

  const cleaned = await cleanShared(input, true);
  if (!cleaned.ok) return cleaned;
  const pwErr = checkPassword(input.password);
  if (pwErr) return pwErr;

  const patch: Record<string, unknown> = { ...cleaned.patch, updated_at: new Date().toISOString() };
  if (typeof input.is_active === "boolean") patch.is_active = input.is_active;

  const newPassword = input.password ? input.password : null;
  if (newPassword) patch.has_password = true;
  else if (input.clear_password) patch.has_password = false;

  const { data, error } = await svc.from("short_links").update(patch).eq("id", id).eq("user_id", ctx.userId).select(LINK_COLUMNS).single();
  if (error || !data) return fail(500, "Could not save changes. Please try again.");

  if (newPassword) {
    const { error: e2 } = await svc
      .from("short_link_secrets")
      .upsert({ link_id: id, password_hash: hashLinkPassword(newPassword) }, { onConflict: "link_id" });
    if (e2) {
      await svc.from("short_links").update({ has_password: false }).eq("id", id);
      return fail(500, "Saved, but the password could not be set. Please set it again.");
    }
  } else if (input.clear_password) {
    await svc.from("short_link_secrets").delete().eq("link_id", id);
  }
  return { ok: true, data };
}

export async function deleteShortLink(ctx: UserCtx, id: string): Promise<ServiceResult<null>> {
  const svc = createServiceClient();
  const { data, error } = await svc.from("short_links").delete().eq("id", id).eq("user_id", ctx.userId).select("id");
  if (error) return fail(500, "Could not delete the link.");
  if (!data || data.length === 0) return fail(404, "Link not found.");
  return { ok: true, data: null };
}

export interface ImportResult {
  line: number;
  ok: boolean;
  slug?: string;
  error?: string;
}

export async function importShortLinks(ctx: UserCtx, rows: ImportRow[]): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  for (const r of rows) {
    if (r.max_clicks === "invalid") {
      results.push({ line: r.line, ok: false, error: "Invalid click limit." });
      continue;
    }
    const res = await createShortLink(
      ctx,
      {
        destination_url: r.destination_url,
        slug: r.slug,
        title: r.title,
        folder: r.folder,
        tags: r.tags,
        expires_at: r.expires_at,
        max_clicks: r.max_clicks,
      },
      { skipRateLimit: true }
    );
    if (res.ok) results.push({ line: r.line, ok: true, slug: String(res.data.slug) });
    else {
      results.push({ line: r.line, ok: false, error: res.error });
      // Out of quota: no point trying the remaining rows.
      if (res.status === 403) {
        for (const rest of rows.slice(results.length)) results.push({ line: rest.line, ok: false, error: res.error });
        break;
      }
    }
  }
  return results;
}
