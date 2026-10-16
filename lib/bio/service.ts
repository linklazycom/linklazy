import { createServiceClient } from "@/lib/supabase/service";
import { validateSlug } from "@/lib/links/slug";
import { getLinkBlocklist, getLinkLimits, ownHosts } from "@/lib/links/server";
import { cleanBioText, validateAvatarUrl, validateBioLink, validateDisplayName, validateTheme } from "@/lib/bio/rules";
import type { ServiceResult, UserCtx } from "@/lib/links/service";

/** Bio-page create/update/delete (Batch 10). Service client AFTER the caller proved who the user is. */
export const BIO_COLUMNS =
  "id, user_id, slug, display_name, bio, avatar_url, theme, is_published, view_count, disabled_reason, created_at, updated_at";
export const BIO_LINK_COLUMNS = "id, bio_id, title, url, position, is_active, click_count, created_at";

const fail = (status: number, error: string, field?: string): { ok: false; status: number; error: string; field?: string } => ({ ok: false, status, error, field });

export interface BioPageInput {
  slug?: string;
  display_name?: unknown;
  bio?: unknown;
  avatar_url?: unknown;
  theme?: unknown;
  is_published?: boolean;
}

async function ownedPage(userId: string, id: string) {
  const svc = createServiceClient();
  const { data } = await svc.from("bio_pages").select("id, user_id, disabled_reason").eq("id", id).maybeSingle();
  // Same answer for "missing" and "someone else's".
  return data && data.user_id === userId ? data : null;
}

export async function createBioPage(ctx: UserCtx, input: BioPageInput): Promise<ServiceResult<Record<string, unknown>>> {
  const s = validateSlug(input.slug ?? "");
  if (!s.ok) return fail(400, s.message, "slug");
  const name = validateDisplayName(input.display_name);
  if (!name.ok) return fail(400, name.message, name.field);
  const blocklist = await getLinkBlocklist();
  if (blocklist.slugs.includes(s.slug)) return fail(400, "That page address is not allowed.", "slug");

  const svc = createServiceClient();
  if (!ctx.isAdmin) {
    const limits = await getLinkLimits();
    const { count } = await svc.from("bio_pages").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId);
    if ((count ?? 0) >= limits.bio_max_pages) {
      return fail(403, `You can have up to ${limits.bio_max_pages} bio page${limits.bio_max_pages === 1 ? "" : "s"}.`);
    }
  }
  const { data, error } = await svc
    .from("bio_pages")
    .insert({ user_id: ctx.userId, slug: s.slug, display_name: name.value })
    .select(BIO_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") return fail(409, "That page address is already taken.", "slug");
    return fail(500, "Could not create the page. Please try again.");
  }
  return { ok: true, data };
}

export async function updateBioPage(ctx: UserCtx, id: string, input: BioPageInput): Promise<ServiceResult<Record<string, unknown>>> {
  const page = await ownedPage(ctx.userId, id);
  if (!page) return fail(404, "Page not found.");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.display_name !== undefined) {
    const v = validateDisplayName(input.display_name);
    if (!v.ok) return fail(400, v.message, v.field);
    patch.display_name = v.value;
  }
  if (input.bio !== undefined) patch.bio = cleanBioText(input.bio);
  if (input.theme !== undefined) {
    const v = validateTheme(input.theme);
    if (!v.ok) return fail(400, v.message, v.field);
    patch.theme = v.value;
  }
  if (input.avatar_url !== undefined) {
    const blocklist = await getLinkBlocklist();
    const v = validateAvatarUrl(input.avatar_url, { ownHosts: ownHosts(), blockedDomains: blocklist.domains });
    if (!v.ok) return fail(400, v.message, v.field);
    patch.avatar_url = v.value;
  }
  if (typeof input.is_published === "boolean") patch.is_published = input.is_published;

  const svc = createServiceClient();
  const { data, error } = await svc.from("bio_pages").update(patch).eq("id", id).eq("user_id", ctx.userId).select(BIO_COLUMNS).single();
  if (error || !data) return fail(500, "Could not save changes. Please try again.");
  return { ok: true, data };
}

export async function deleteBioPage(ctx: UserCtx, id: string): Promise<ServiceResult<null>> {
  const svc = createServiceClient();
  const { data, error } = await svc.from("bio_pages").delete().eq("id", id).eq("user_id", ctx.userId).select("id");
  if (error) return fail(500, "Could not delete the page.");
  if (!data || data.length === 0) return fail(404, "Page not found.");
  return { ok: true, data: null };
}

async function linkOpts() {
  const blocklist = await getLinkBlocklist();
  return { ownHosts: ownHosts(), blockedDomains: blocklist.domains };
}

export async function addBioLink(ctx: UserCtx, bioId: string, input: { title?: unknown; url?: unknown }): Promise<ServiceResult<Record<string, unknown>>> {
  if (!(await ownedPage(ctx.userId, bioId))) return fail(404, "Page not found.");
  const v = validateBioLink(input, await linkOpts());
  if (!v.ok) return fail(400, v.message, v.field);

  const svc = createServiceClient();
  const { data: existing } = await svc.from("bio_links").select("position").eq("bio_id", bioId).order("position", { ascending: false }).limit(1);
  const { count } = await svc.from("bio_links").select("id", { count: "exact", head: true }).eq("bio_id", bioId);
  if (!ctx.isAdmin) {
    const limits = await getLinkLimits();
    if ((count ?? 0) >= limits.bio_max_links) return fail(403, `A bio page can have up to ${limits.bio_max_links} links.`);
  }
  const position = existing && existing[0] ? Number(existing[0].position) + 1 : 0;
  const { data, error } = await svc.from("bio_links").insert({ bio_id: bioId, title: v.title, url: v.url, position }).select(BIO_LINK_COLUMNS).single();
  if (error || !data) return fail(500, "Could not add the link.");
  return { ok: true, data };
}

export async function updateBioLink(
  ctx: UserCtx,
  bioId: string,
  linkId: string,
  input: { title?: unknown; url?: unknown; is_active?: boolean }
): Promise<ServiceResult<Record<string, unknown>>> {
  if (!(await ownedPage(ctx.userId, bioId))) return fail(404, "Page not found.");
  const svc = createServiceClient();
  const { data: current } = await svc.from("bio_links").select("id, title, url").eq("id", linkId).eq("bio_id", bioId).maybeSingle();
  if (!current) return fail(404, "Link not found.");

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined || input.url !== undefined) {
    const v = validateBioLink({ title: input.title ?? current.title, url: input.url ?? current.url }, await linkOpts());
    if (!v.ok) return fail(400, v.message, v.field);
    patch.title = v.title;
    patch.url = v.url;
  }
  if (typeof input.is_active === "boolean") patch.is_active = input.is_active;
  if (Object.keys(patch).length === 0) return fail(400, "Nothing to change.");

  const { data, error } = await svc.from("bio_links").update(patch).eq("id", linkId).eq("bio_id", bioId).select(BIO_LINK_COLUMNS).single();
  if (error || !data) return fail(500, "Could not save the link.");
  return { ok: true, data };
}

export async function deleteBioLink(ctx: UserCtx, bioId: string, linkId: string): Promise<ServiceResult<null>> {
  if (!(await ownedPage(ctx.userId, bioId))) return fail(404, "Page not found.");
  const svc = createServiceClient();
  const { data, error } = await svc.from("bio_links").delete().eq("id", linkId).eq("bio_id", bioId).select("id");
  if (error) return fail(500, "Could not delete the link.");
  if (!data || data.length === 0) return fail(404, "Link not found.");
  return { ok: true, data: null };
}

/** `ids` must be exactly the page's current link ids, in the new order. */
export async function reorderBioLinks(ctx: UserCtx, bioId: string, ids: string[]): Promise<ServiceResult<null>> {
  if (!(await ownedPage(ctx.userId, bioId))) return fail(404, "Page not found.");
  const svc = createServiceClient();
  const { data: current } = await svc.from("bio_links").select("id").eq("bio_id", bioId);
  const have = new Set((current ?? []).map((r) => r.id as string));
  if (ids.length !== have.size || new Set(ids).size !== ids.length || !ids.every((i) => have.has(i))) {
    return fail(400, "The link list is out of date. Reload the page and try again.");
  }
  for (let i = 0; i < ids.length; i++) {
    const { error } = await svc.from("bio_links").update({ position: i }).eq("id", ids[i]).eq("bio_id", bioId);
    if (error) return fail(500, "Could not save the new order.");
  }
  return { ok: true, data: null };
}
