import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit } from "@/lib/rate-limit";
import { getLinkLimits, ownHosts } from "@/lib/links/server";
import type { ServiceResult, UserCtx } from "@/lib/links/service";
import { cleanLine } from "@/lib/projects/rules";
import { checkBacklink, type CheckOutcome } from "@/lib/backlinks/check";
import { hostBelongsToDomain } from "@/lib/backlinks/match";
import { ANCHOR_INPUT_MAX, NOTE_INPUT_MAX, validateBacklinkFields, type BacklinkImportRow } from "@/lib/backlinks/rules";

/** Add / update / delete / check for tracked backlinks (Batch 13). Service client AFTER the caller proved who the user is. */
export const BACKLINK_COLUMNS =
  "id, user_id, project_id, source_url, source_domain, target_url, anchor_text, note, origin, status, reason, rel, is_follow, found_href, found_anchor, page_robots, match_count, monitoring, consecutive_failures, first_found_at, last_found_at, last_checked_at, last_status_change_at, created_at, updated_at";

export const CHECK_COLUMNS = "id, backlink_id, checked_at, trigger, status, reason, http_status, final_url, rel, is_follow, found_href, found_anchor, page_robots, match_count, duration_ms, evidence";

/** Newest check rows kept per backlink. */
export const HISTORY_KEEP = 30;
/** A backlink cannot be re-checked more often than this (manual or scheduled). */
export const MIN_RECHECK_SECONDS = 30;

const fail = (status: number, error: string, field?: string): { ok: false; status: number; error: string; field?: string } => ({ ok: false, status, error, field });

export type BacklinkRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  source_url: string;
  source_domain: string;
  target_url: string;
  anchor_text: string | null;
  status: string;
  consecutive_failures: number;
  first_found_at: string | null;
  last_checked_at: string | null;
  monitoring: boolean;
} & Record<string, unknown>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadOwnedProject(userId: string, projectId: string | null | undefined): Promise<{ ok: true; project: { id: string; domain: string } | null } | { ok: false; status: number; error: string; field: string }> {
  if (projectId === null || projectId === undefined || projectId === "") return { ok: true, project: null };
  if (!UUID_RE.test(projectId)) return { ok: false, status: 400, error: "Choose one of your projects.", field: "project_id" };
  const { data } = await createServiceClient().from("projects").select("id, domain").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (!data) return { ok: false, status: 400, error: "Choose one of your projects.", field: "project_id" };
  return { ok: true, project: data as { id: string; domain: string } };
}

function targetFitsProject(targetUrl: string, project: { domain: string } | null): boolean {
  if (!project) return true;
  try {
    return hostBelongsToDomain(new URL(targetUrl).hostname, project.domain);
  } catch {
    return false;
  }
}

async function capacity(ctx: UserCtx): Promise<{ ok: true; remaining: number } | { ok: false; status: number; error: string }> {
  if (ctx.isAdmin) return { ok: true, remaining: Number.POSITIVE_INFINITY };
  const limits = await getLinkLimits();
  if (limits.backlink_max_per_user === 0) return { ok: false, status: 403, error: "Backlink monitoring is not available right now." };
  const { count } = await createServiceClient().from("backlinks").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId);
  const remaining = limits.backlink_max_per_user - (count ?? 0);
  if (remaining <= 0) return { ok: false, status: 403, error: `You can track up to ${limits.backlink_max_per_user} backlinks. Delete one to add another.` };
  return { ok: true, remaining };
}

interface AddInput {
  source_url?: unknown;
  target_url?: unknown;
  anchor_text?: unknown;
  note?: unknown;
  project_id?: string | null;
}

async function insertBacklink(userId: string, input: AddInput, project: { id: string; domain: string } | null, origin: "manual" | "csv"): Promise<ServiceResult<Record<string, unknown>>> {
  const v = validateBacklinkFields(input, ownHosts());
  if (!v.ok) return fail(400, v.message, v.field);
  if (!targetFitsProject(v.value.target.url, project)) {
    return fail(400, `The target page must be on ${project?.domain} (the website of the project you chose).`, "target_url");
  }
  const { data, error } = await createServiceClient()
    .from("backlinks")
    .insert({
      user_id: userId,
      project_id: project?.id ?? null,
      source_url: v.value.source.url,
      source_domain: v.value.source.domain,
      target_url: v.value.target.url,
      anchor_text: v.value.anchor,
      note: v.value.note,
      origin,
    })
    .select(BACKLINK_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") return fail(409, "You are already tracking this link.", "source_url");
    return fail(500, "Could not add the backlink. Please try again.");
  }
  return { ok: true, data };
}

export async function addBacklink(ctx: UserCtx, input: AddInput): Promise<ServiceResult<Record<string, unknown>>> {
  const cap = await capacity(ctx);
  if (!cap.ok) return fail(cap.status, cap.error);
  const proj = await loadOwnedProject(ctx.userId, input.project_id);
  if (!proj.ok) return fail(proj.status, proj.error, proj.field);
  return insertBacklink(ctx.userId, input, proj.project, "manual");
}

export type ImportResult = { line: number; ok: boolean; error?: string };

export async function importBacklinks(ctx: UserCtx, rows: BacklinkImportRow[], projectId: string | null): Promise<ServiceResult<ImportResult[]>> {
  const cap = await capacity(ctx);
  if (!cap.ok) return fail(cap.status, cap.error);
  const proj = await loadOwnedProject(ctx.userId, projectId);
  if (!proj.ok) return fail(proj.status, proj.error, proj.field);

  let remaining = cap.remaining;
  const results: ImportResult[] = [];
  for (const row of rows) {
    if (remaining <= 0) {
      results.push({ line: row.line, ok: false, error: "Your backlink limit was reached." });
      continue;
    }
    const r = await insertBacklink(ctx.userId, row, proj.project, "csv");
    if (r.ok) {
      remaining--;
      results.push({ line: row.line, ok: true });
    } else {
      results.push({ line: row.line, ok: false, error: r.error });
    }
  }
  return { ok: true, data: results };
}

export async function loadOwnedBacklink(userId: string, id: string): Promise<BacklinkRow | null> {
  const { data } = await createServiceClient().from("backlinks").select(BACKLINK_COLUMNS).eq("id", id).eq("user_id", userId).maybeSingle();
  return (data as BacklinkRow | null) ?? null;
}

export async function updateBacklink(
  ctx: UserCtx,
  id: string,
  input: { project_id?: string | null; anchor_text?: unknown; note?: unknown; monitoring?: boolean }
): Promise<ServiceResult<Record<string, unknown>>> {
  const row = await loadOwnedBacklink(ctx.userId, id);
  if (!row) return fail(404, "Backlink not found."); // same answer for "missing" and "someone else's"

  const patch: Record<string, unknown> = {};
  if (input.project_id !== undefined) {
    const proj = await loadOwnedProject(ctx.userId, input.project_id);
    if (!proj.ok) return fail(proj.status, proj.error, proj.field);
    if (!targetFitsProject(row.target_url, proj.project)) {
      return fail(400, `This backlink's target page is not on ${proj.project?.domain}, so it cannot belong to that project.`, "project_id");
    }
    patch.project_id = proj.project?.id ?? null;
  }
  if (input.anchor_text !== undefined) patch.anchor_text = cleanLine(input.anchor_text, ANCHOR_INPUT_MAX);
  if (input.note !== undefined) patch.note = cleanLine(input.note, NOTE_INPUT_MAX);
  if (typeof input.monitoring === "boolean") patch.monitoring = input.monitoring;

  const { data, error } = await createServiceClient()
    .from("backlinks")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select(BACKLINK_COLUMNS)
    .single();
  if (error || !data) return fail(500, "Could not save changes. Please try again.");
  return { ok: true, data };
}

export async function deleteBacklink(ctx: UserCtx, id: string): Promise<ServiceResult<null>> {
  const { data, error } = await createServiceClient().from("backlinks").delete().eq("id", id).eq("user_id", ctx.userId).select("id");
  if (error) return fail(500, "Could not delete the backlink.");
  if (!data || data.length === 0) return fail(404, "Backlink not found.");
  return { ok: true, data: null };
}

/** Writes one check result: history row, then the backlink's current state. Failures to store history never lose the state update. */
export async function applyCheck(row: BacklinkRow, o: CheckOutcome, trigger: "manual" | "scheduled"): Promise<{ backlink: Record<string, unknown> | null; check: Record<string, unknown> | null }> {
  const svc = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: check } = await svc
    .from("backlink_checks")
    .insert({
      backlink_id: row.id,
      checked_at: nowIso,
      trigger,
      status: o.status,
      reason: o.reason,
      http_status: o.httpStatus,
      final_url: o.finalUrl,
      rel: o.rel,
      is_follow: o.isFollow,
      found_href: o.foundHref,
      found_anchor: o.foundAnchor?.slice(0, 300) ?? null,
      page_robots: o.pageRobots,
      match_count: o.matchCount,
      duration_ms: o.durationMs,
      evidence: o.evidence?.slice(0, 600) ?? null,
    })
    .select(CHECK_COLUMNS)
    .single();

  // Temporary problems (source down, blocked, our own error) keep the last known link details.
  const keepLastSeen = o.status === "unavailable" || o.status === "check_failed";
  const patch: Record<string, unknown> = {
    status: o.status,
    reason: o.reason,
    last_checked_at: nowIso,
    updated_at: nowIso,
    consecutive_failures: o.status === "active" ? 0 : (row.consecutive_failures ?? 0) + 1,
  };
  if (!keepLastSeen) {
    Object.assign(patch, { rel: o.rel, is_follow: o.isFollow, found_href: o.foundHref, found_anchor: o.foundAnchor?.slice(0, 300) ?? null, page_robots: o.pageRobots, match_count: o.matchCount });
  }
  if (o.status === "active") {
    patch.first_found_at = row.first_found_at ?? nowIso;
    patch.last_found_at = nowIso;
  }
  if (row.status !== o.status) patch.last_status_change_at = nowIso;

  const { data: backlink } = await svc.from("backlinks").update(patch).eq("id", row.id).select(BACKLINK_COLUMNS).single();

  // Keep only the newest HISTORY_KEEP rows.
  const { data: old } = await svc.from("backlink_checks").select("id").eq("backlink_id", row.id).order("checked_at", { ascending: false }).range(HISTORY_KEEP, HISTORY_KEEP + 200);
  if (old && old.length > 0) {
    await svc.from("backlink_checks").delete().in("id", old.map((r) => r.id as string));
  }
  return { backlink: backlink ?? null, check: check ?? null };
}

/** Runs the checker for one backlink and stores the result. */
export async function runAndStoreCheck(row: BacklinkRow, trigger: "manual" | "scheduled") {
  const outcome = await checkBacklink({ sourceUrl: row.source_url, targetUrl: row.target_url, expectedAnchor: row.anchor_text });
  const stored = await applyCheck(row, outcome, trigger);
  return { outcome, ...stored };
}

/** Manual "Check now": ownership, per-user hourly limit and a short per-backlink cool-down. */
export async function checkNow(ctx: UserCtx, id: string): Promise<ServiceResult<{ backlink: Record<string, unknown> | null; check: Record<string, unknown> | null }>> {
  const row = await loadOwnedBacklink(ctx.userId, id);
  if (!row) return fail(404, "Backlink not found.");
  if (row.last_checked_at && Date.now() - Date.parse(row.last_checked_at) < MIN_RECHECK_SECONDS * 1000) {
    return fail(429, "This link was just checked. Please wait a moment.");
  }
  if (!ctx.isAdmin) {
    const limits = await getLinkLimits();
    const { allowed } = await checkRateLimit("backlink_check", ctx.userId, { max: limits.backlink_checks_per_hour, windowMinutes: 60 });
    if (!allowed) return fail(429, "You've checked a lot of links this hour. Please try again later.");
  }
  const r = await runAndStoreCheck(row, "manual");
  return { ok: true, data: { backlink: r.backlink, check: r.check } };
}
