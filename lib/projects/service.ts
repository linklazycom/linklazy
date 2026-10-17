import { createServiceClient } from "@/lib/supabase/service";
import { getLinkLimits, ownHosts } from "@/lib/links/server";
import type { ServiceResult, UserCtx } from "@/lib/links/service";
import {
  cleanCompetitors,
  cleanDescription,
  cleanKeywords,
  cleanNotes,
  diffKeywords,
  normalizeProjectUrl,
  validateCountry,
  validateLanguage,
  validateNiche,
  validateProjectName,
} from "@/lib/projects/rules";

/** Create / update / delete for buyer projects (Batch 12). Service client AFTER the caller proved who the user is. */
export const PROJECT_COLUMNS = "id, user_id, name, canonical_url, domain, description, niche, country, language, competitors, notes, created_at, updated_at";

/** Admins are not limited by the per-user settings, but keep a sane ceiling. */
const ADMIN_KEYWORD_CAP = 500;

const fail = (status: number, error: string, field?: string): { ok: false; status: number; error: string; field?: string } => ({ ok: false, status, error, field });

export interface ProjectInput {
  name?: unknown;
  url?: unknown;
  description?: unknown;
  niche?: unknown;
  country?: unknown;
  language?: unknown;
  keywords?: unknown;
  competitors?: unknown;
  notes?: unknown;
}

type ProjectRow = Record<string, unknown> & { id: string; domain: string };

async function keywordCap(ctx: UserCtx): Promise<number> {
  if (ctx.isAdmin) return ADMIN_KEYWORD_CAP;
  return (await getLinkLimits()).project_max_keywords;
}

async function loadKeywords(projectId: string): Promise<{ id: string; keyword: string }[]> {
  const { data } = await createServiceClient().from("project_keywords").select("id, keyword").eq("project_id", projectId).order("created_at", { ascending: true });
  return data ?? [];
}

export async function createProject(ctx: UserCtx, input: ProjectInput): Promise<ServiceResult<Record<string, unknown>>> {
  const name = validateProjectName(input.name);
  if (!name.ok) return fail(400, name.message, name.field);
  const url = normalizeProjectUrl(input.url, ownHosts());
  if (!url.ok) return fail(400, url.message, url.field);
  const niche = validateNiche(input.niche);
  if (!niche.ok) return fail(400, niche.message, niche.field);
  const country = validateCountry(input.country);
  if (!country.ok) return fail(400, country.message, country.field);
  const language = validateLanguage(input.language);
  if (!language.ok) return fail(400, language.message, language.field);
  const keywords = cleanKeywords(input.keywords ?? [], await keywordCap(ctx));
  if (!keywords.ok) return fail(400, keywords.message, keywords.field);
  const competitors = cleanCompetitors(input.competitors ?? [], { ownDomain: url.value.domain, ownHosts: ownHosts() });
  if (!competitors.ok) return fail(400, competitors.message, competitors.field);

  const svc = createServiceClient();
  if (!ctx.isAdmin) {
    const limits = await getLinkLimits();
    if (limits.project_max_per_user === 0) return fail(403, "Projects are not available right now.");
    const { count } = await svc.from("projects").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId);
    if ((count ?? 0) >= limits.project_max_per_user) {
      return fail(403, `You can have up to ${limits.project_max_per_user} project${limits.project_max_per_user === 1 ? "" : "s"}. Delete one to add another.`);
    }
  }

  const { data, error } = await svc
    .from("projects")
    .insert({
      user_id: ctx.userId,
      name: name.value,
      canonical_url: url.value.canonicalUrl,
      domain: url.value.domain,
      description: cleanDescription(input.description),
      niche: niche.value,
      country: country.value,
      language: language.value,
      competitors: competitors.domains,
      notes: cleanNotes(input.notes),
    })
    .select(PROJECT_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") return fail(409, `You already have a project for ${url.value.domain}.`, "url");
    return fail(500, "Could not create the project. Please try again.");
  }
  const project = data as ProjectRow;

  if (keywords.keywords.length > 0) {
    const { error: kwError } = await svc.from("project_keywords").insert(keywords.keywords.map((keyword) => ({ project_id: project.id, keyword })));
    if (kwError) {
      await svc.from("projects").delete().eq("id", project.id); // all-or-nothing: no half-saved project
      return fail(500, "Could not save the keywords. Please try again.");
    }
  }
  return { ok: true, data: { ...project, keywords: keywords.keywords } };
}

export async function updateProject(ctx: UserCtx, id: string, input: ProjectInput): Promise<ServiceResult<Record<string, unknown>>> {
  const svc = createServiceClient();
  const { data: existing } = await svc.from("projects").select("id, user_id, domain").eq("id", id).eq("user_id", ctx.userId).maybeSingle();
  // Same answer for "missing" and "someone else's" so ids can't be probed.
  if (!existing) return fail(404, "Project not found.");

  // Validate everything first; write only when all of it is fine.
  const patch: Record<string, unknown> = {};
  let domain = existing.domain as string;
  if (input.name !== undefined) {
    const v = validateProjectName(input.name);
    if (!v.ok) return fail(400, v.message, v.field);
    patch.name = v.value;
  }
  if (input.url !== undefined) {
    const v = normalizeProjectUrl(input.url, ownHosts());
    if (!v.ok) return fail(400, v.message, v.field);
    patch.canonical_url = v.value.canonicalUrl;
    patch.domain = v.value.domain;
    domain = v.value.domain;
  }
  if (input.description !== undefined) patch.description = cleanDescription(input.description);
  if (input.notes !== undefined) patch.notes = cleanNotes(input.notes);
  if (input.niche !== undefined) {
    const v = validateNiche(input.niche);
    if (!v.ok) return fail(400, v.message, v.field);
    patch.niche = v.value;
  }
  if (input.country !== undefined) {
    const v = validateCountry(input.country);
    if (!v.ok) return fail(400, v.message, v.field);
    patch.country = v.value;
  }
  if (input.language !== undefined) {
    const v = validateLanguage(input.language);
    if (!v.ok) return fail(400, v.message, v.field);
    patch.language = v.value;
  }
  if (input.competitors !== undefined) {
    const v = cleanCompetitors(input.competitors, { ownDomain: domain, ownHosts: ownHosts() });
    if (!v.ok) return fail(400, v.message, v.field);
    patch.competitors = v.domains;
  }
  let wantedKeywords: string[] | null = null;
  if (input.keywords !== undefined) {
    const v = cleanKeywords(input.keywords, await keywordCap(ctx));
    if (!v.ok) return fail(400, v.message, v.field);
    wantedKeywords = v.keywords;
  }

  const { data, error } = await svc
    .from("projects")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select(PROJECT_COLUMNS)
    .single();
  if (error || !data) {
    if (error?.code === "23505") return fail(409, `You already have a project for ${domain}.`, "url");
    return fail(500, "Could not save changes. Please try again.");
  }

  if (wantedKeywords) {
    const { toInsert, toDeleteIds } = diffKeywords(await loadKeywords(id), wantedKeywords);
    // Add first, remove after: a failure in between never loses keywords the user wanted to keep.
    if (toInsert.length > 0) {
      const { error: e1 } = await svc.from("project_keywords").insert(toInsert.map((keyword) => ({ project_id: id, keyword })));
      if (e1) return fail(500, "Saved, but the keywords could not be updated. Please try again.", "keywords");
    }
    if (toDeleteIds.length > 0) {
      const { error: e2 } = await svc.from("project_keywords").delete().eq("project_id", id).in("id", toDeleteIds);
      if (e2) return fail(500, "Saved, but some old keywords could not be removed. Please try again.", "keywords");
    }
  }
  const keywords = (await loadKeywords(id)).map((k) => k.keyword);
  return { ok: true, data: { ...(data as ProjectRow), keywords } };
}

export async function deleteProject(ctx: UserCtx, id: string): Promise<ServiceResult<null>> {
  const { data, error } = await createServiceClient().from("projects").delete().eq("id", id).eq("user_id", ctx.userId).select("id");
  if (error) return fail(500, "Could not delete the project.");
  if (!data || data.length === 0) return fail(404, "Project not found.");
  return { ok: true, data: null };
}

/**
 * For short links: null/undefined project means "no project". A project id must belong to the same user.
 * Returns the id to store (or null), or a ready-made error.
 */
export async function resolveOwnedProjectId(
  userId: string,
  projectId: string | null | undefined
): Promise<{ ok: true; value: string | null } | { ok: false; status: number; error: string; field: string }> {
  if (projectId === null || projectId === undefined || projectId === "") return { ok: true, value: null };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    return { ok: false, status: 400, error: "Choose one of your projects.", field: "project_id" };
  }
  const { data } = await createServiceClient().from("projects").select("id").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (!data) return { ok: false, status: 400, error: "Choose one of your projects.", field: "project_id" };
  return { ok: true, value: projectId };
}
