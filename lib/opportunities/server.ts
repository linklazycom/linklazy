import { createServiceClient } from "@/lib/supabase/service";
import { AiUnavailableError, searchWeb } from "@/lib/api-providers";
import { buildQueries, projectTerms } from "@/lib/opportunities/queries";
import { collectCandidates, excludedDomains, planWrites, type QueryResult } from "@/lib/opportunities/plan";
import { MAX_PER_PROJECT, RESULTS_PER_QUERY, type OppType } from "@/lib/opportunities/rules";

/** The feature switch name used for the kill switch and the usage log. */
export const OPPORTUNITY_FEATURE = "feature_opportunity_finder";
/** A saved search answer is reused for this long, so the same phrase does not spend the free quota twice. */
export const SEARCH_CACHE_TTL_MS = 7 * 24 * 60 * 60_000;
/** After this long no new search is started (the answers so far are still saved). */
const RUN_DEADLINE_MS = 40_000;

export class OpportunityError extends Error {
  status: number;
  /** true when the failure happened before any search result was obtained, i.e. nothing was delivered */
  nothingDelivered: boolean;
  unavailable: boolean;
  constructor(message: string, status: number, opts: { nothingDelivered?: boolean; unavailable?: boolean } = {}) {
    super(message);
    this.name = "OpportunityError";
    this.status = status;
    this.nothingDelivered = opts.nothingDelivered ?? true;
    this.unavailable = opts.unavailable ?? false;
  }
}

export interface RunSummary {
  queries: number;
  queriesAnswered: number;
  fromCache: number;
  hits: number;
  added: number;
  updated: number;
  unchanged: number;
  skippedForCapacity: number;
  providerNames: string[];
}

async function recordRun(userId: string, projectId: string | null, types: OppType[], s: Partial<RunSummary>, ok: boolean, error: string | null) {
  try {
    await createServiceClient().from("opportunity_runs").insert({
      user_id: userId,
      project_id: projectId,
      types,
      queries: s.queries ?? 0,
      hits: s.hits ?? 0,
      added: s.added ?? 0,
      updated: s.updated ?? 0,
      from_cache: s.fromCache ?? 0,
      ok,
      error: error ? error.slice(0, 300) : null,
    });
  } catch {
    // History must never break the feature.
  }
}

/**
 * One "Find opportunities" run for a project the user owns. Searches with the admin-managed search providers (official
 * APIs only), scores the results, and stores new pages / better-scoring replacements. Throws OpportunityError with a
 * message that is safe to show; `nothingDelivered` tells the caller to refund a charge.
 */
export async function runOpportunitySearch(userId: string, projectId: string, types: OppType[]): Promise<RunSummary> {
  const db = createServiceClient();

  const { data: project } = await db.from("projects").select("id, canonical_url, domain, niche, competitors").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (!project) throw new OpportunityError("Project not found.", 404);

  const { data: kw } = await db.from("project_keywords").select("keyword").eq("project_id", projectId).order("created_at", { ascending: true }).limit(10);
  const keywords = (kw ?? []).map((k) => String(k.keyword));
  const niche = (project.niche as string | null) ?? null;
  const planned = buildQueries(types, { niche, keywords });
  if (planned.length === 0) throw new OpportunityError("Add a niche or at least one keyword to this project first. The finder needs them to know what to look for.", 400);

  const { count } = await db.from("opportunities").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  const stored = count ?? 0;
  if (stored >= MAX_PER_PROJECT) {
    throw new OpportunityError(`This project already has ${MAX_PER_PROJECT} opportunities. Delete or ignore some to find more.`, 409);
  }

  const started = Date.now();
  const results: QueryResult[] = [];
  let fromCache = 0;
  let lastError: AiUnavailableError | null = null;
  const providerNames = new Set<string>();
  for (const q of planned) {
    if (results.length > 0 && Date.now() - started > RUN_DEADLINE_MS) break;
    try {
      const r = await searchWeb({ query: q.query, feature: OPPORTUNITY_FEATURE, userId, maxResults: RESULTS_PER_QUERY, cacheTtlMs: SEARCH_CACHE_TTL_MS });
      if (r.fromCache) fromCache++;
      providerNames.add(r.providerName);
      results.push({ type: q.type, query: q.query, provider: r.providerName, hits: r.hits });
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) throw err;
      lastError = err;
      // Switched off or not set up: stop at once. A temporary failure: try the remaining phrases.
      if (err.code === "disabled" || err.code === "not_configured") break;
    }
  }

  if (results.length === 0) {
    const msg = lastError?.message ?? "Web search is temporarily unavailable. Please try again.";
    await recordRun(userId, projectId, types, { queries: planned.length }, false, msg);
    throw new OpportunityError(msg, 503, { unavailable: true });
  }

  const exclude = excludedDomains(project.domain as string, ((project.competitors as string[] | null) ?? []).map(String));
  const { candidates, seen } = collectCandidates(results, { terms: projectTerms({ niche, keywords }), exclude });

  let existing: { id: string; domain: string; type: string; score: number }[] = [];
  if (candidates.length > 0) {
    const { data } = await db
      .from("opportunities")
      .select("id, domain, opp_type, score")
      .eq("project_id", projectId)
      .in("domain", [...new Set(candidates.map((c) => c.domain))]);
    existing = (data ?? []).map((r) => ({ id: r.id as string, domain: r.domain as string, type: r.opp_type as string, score: Number(r.score) }));
  }
  const plan = planWrites(candidates, existing, MAX_PER_PROJECT - stored);

  const now = new Date().toISOString();
  const row = (c: (typeof candidates)[number]) => ({
    opp_type: c.type,
    url: c.url,
    domain: c.domain,
    title: c.title,
    snippet: c.snippet,
    query: c.query,
    provider: c.provider,
    score: c.score,
    confidence: c.confidence,
    breakdown: c.breakdown,
    published_at: c.publishedAt,
  });

  let added = 0;
  if (plan.inserts.length > 0) {
    const { data, error } = await db
      .from("opportunities")
      .upsert(
        plan.inserts.map((c) => ({ user_id: userId, project_id: projectId, ...row(c) })),
        { onConflict: "project_id,domain,opp_type", ignoreDuplicates: true }
      )
      .select("id");
    if (error) {
      await recordRun(userId, projectId, types, { queries: planned.length }, false, "save failed");
      throw new OpportunityError("The search worked but the results could not be saved. Please try again.", 500);
    }
    added = (data ?? []).length;
  }
  let updated = 0;
  for (const u of plan.updates) {
    const { error } = await db.from("opportunities").update({ ...row(u.cand), updated_at: now }).eq("id", u.id).eq("user_id", userId);
    if (!error) updated++;
  }

  const summary: RunSummary = {
    queries: planned.length,
    queriesAnswered: results.length,
    fromCache,
    hits: seen,
    added,
    updated,
    unchanged: plan.unchanged,
    skippedForCapacity: plan.skippedForCapacity,
    providerNames: [...providerNames],
  };
  await recordRun(userId, projectId, types, summary, true, null);
  return summary;
}
