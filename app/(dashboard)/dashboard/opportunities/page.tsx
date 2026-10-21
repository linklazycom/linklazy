import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { FinderPanel } from "@/components/opportunities/finder-panel";
import { OpportunityActions } from "@/components/opportunities/row-actions";
import { CONFIDENCE_LABELS, OPP_PER_PAGE, OPP_STATUSES, OPP_STATUS_LABELS, OPP_TYPES, oppTypeLabel, parseOppFilters, type Confidence } from "@/lib/opportunities/rules";
import { SCORE_MAX, type ScorePart } from "@/lib/opportunities/score";

export const metadata = { title: "Opportunity Finder" };
export const dynamic = "force-dynamic";

const PART_LABEL: Record<ScorePart, string> = { relevance: "Relevance", submission: "Submission evidence", quality: "Quality signals", clarity: "Clarity", freshness: "Freshness" };
const CONF_STYLE: Record<Confidence, string> = { likely: "bg-green-100 text-green-800", possible: "bg-amber-100 text-amber-800", unknown: "bg-gray-100 text-gray-700" };
const selectClass = "rounded-chip border border-line bg-white px-2 py-1 text-sm";

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = parseOppFilters(await searchParams);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: projects }, featureOn, providerCount] = await Promise.all([
    supabase.from("projects").select("id, name").eq("user_id", user.id).order("name", { ascending: true }).limit(50),
    isFeatureEnabled("feature_opportunity_finder"),
    createServiceClient().from("api_providers").select("id", { count: "exact", head: true }).eq("kind", "search").eq("enabled", true),
  ]);
  const ready = featureOn && (providerCount.count ?? 0) > 0;

  let q = supabase
    .from("opportunities")
    .select("id, project_id, opp_type, url, domain, title, snippet, query, score, confidence, breakdown, status, note, found_at", { count: "exact" })
    .eq("user_id", user.id)
    .gte("score", f.minScore)
    .range((f.page - 1) * OPP_PER_PAGE, f.page * OPP_PER_PAGE - 1);
  if (f.project) q = q.eq("project_id", f.project);
  if (f.type) q = q.eq("opp_type", f.type);
  if (f.status === null) q = q.neq("status", "ignored");
  else if (f.status !== "all") q = q.eq("status", f.status);
  q = f.sort === "newest" ? q.order("found_at", { ascending: false }) : f.sort === "domain" ? q.order("domain", { ascending: true }) : q.order("score", { ascending: false }).order("found_at", { ascending: false });
  const { data: rows, count, error } = await q;
  if (error) throw new Error("Could not load opportunities. Has SQL 054 been run?");

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / OPP_PER_PAGE));
  const projectName = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));

  const qs = (over: Record<string, string | number | null>) => {
    const s = new URLSearchParams();
    const base: Record<string, string | number | null> = { project: f.project, type: f.type, status: f.status, min: f.minScore || null, sort: f.sort === "score" ? null : f.sort, page: f.page > 1 ? f.page : null, ...over };
    for (const [k, v] of Object.entries(base)) if (v !== null && v !== "") s.set(k, String(v));
    const t = s.toString();
    return t ? `?${t}` : "";
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">Opportunity Finder</h1>
        <p className="text-sm text-muted">Find places that may give your site a link: guest-post pages, directories, resource pages, communities and blogs. You decide who to contact; nothing is sent for you.</p>
      </div>

      {!ready && (
        <p className="rounded-chip border border-line bg-amber-50 p-4 text-sm text-amber-900">
          {featureOn ? "Search is not set up yet. An admin needs to add and switch on a web search provider." : "The Opportunity Finder is currently switched off."} Your saved opportunities below stay available.
        </p>
      )}

      <FinderPanel projects={projects ?? []} initialProject={f.project} ready={ready} />

      <section className="space-y-3">
        <form method="get" className="flex flex-wrap items-end gap-2 rounded-chip border border-line bg-white p-3 text-sm">
          <select name="project" defaultValue={f.project ?? ""} aria-label="Project" className={selectClass}>
            <option value="">All projects</option>
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select name="type" defaultValue={f.type ?? ""} aria-label="Kind" className={selectClass}>
            <option value="">All kinds</option>
            {OPP_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select name="status" defaultValue={f.status ?? ""} aria-label="Status" className={selectClass}>
            <option value="">Not ignored</option>
            <option value="all">All, incl. ignored</option>
            {OPP_STATUSES.map((s) => <option key={s} value={s}>{OPP_STATUS_LABELS[s]}</option>)}
          </select>
          <label className="flex items-center gap-1 text-muted">Min score <input name="min" type="number" min={0} max={100} defaultValue={f.minScore || ""} className="w-16 rounded-chip border border-line px-2 py-1" /></label>
          <select name="sort" defaultValue={f.sort} aria-label="Sort" className={selectClass}>
            <option value="score">Best score first</option>
            <option value="newest">Newest first</option>
            <option value="domain">Website A–Z</option>
          </select>
          <button type="submit" className="rounded-chip border border-line px-3 py-1">Filter</button>
          <Link href="/dashboard/opportunities" className="px-2 py-1 text-muted underline">Reset</Link>
          <a href={`/api/opportunities/export${qs({ page: null })}`} className="ml-auto underline">Download CSV</a>
        </form>

        <p className="text-sm text-muted">{total} opportunit{total === 1 ? "y" : "ies"}</p>

        {(rows ?? []).length === 0 ? (
          <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">Nothing here yet. Choose a project above and press “Find opportunities”.</p>
        ) : (
          <ul className="space-y-3">
            {(rows ?? []).map((o) => {
              const conf = (o.confidence as Confidence) in CONFIDENCE_LABELS ? (o.confidence as Confidence) : "unknown";
              const parts = (o.breakdown ?? {}) as Record<string, { points?: number; max?: number; note?: string }>;
              return (
                <li key={o.id as string} className="rounded-chip border border-line bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <a href={o.url as string} target="_blank" rel="noopener noreferrer nofollow" className="break-words font-medium underline">{(o.title as string) || (o.domain as string)}</a>
                      <p className="break-all text-xs text-muted">{o.domain as string} · {oppTypeLabel(o.opp_type as string)} · {projectName.get(o.project_id as string) ?? "—"} · found {String(o.found_at).slice(0, 10)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-chip px-2 py-0.5 text-xs ${CONF_STYLE[conf]}`}>{CONFIDENCE_LABELS[conf]}</span>
                      <span className="rounded-chip bg-gray-900 px-2 py-0.5 text-xs font-medium text-white" title="Score out of 100">{o.score as number}</span>
                    </div>
                  </div>
                  {o.snippet ? <p className="mt-2 text-sm">{o.snippet as string}</p> : null}
                  {o.note ? <p className="mt-2 whitespace-pre-wrap rounded-chip bg-amber-50 p-2 text-sm">{o.note as string}</p> : null}
                  <details className="mt-2 text-xs text-muted">
                    <summary className="cursor-pointer">Why this score?</summary>
                    <ul className="mt-1 space-y-1">
                      {(Object.keys(SCORE_MAX) as ScorePart[]).map((k) => (
                        <li key={k}><strong>{PART_LABEL[k]} {parts[k]?.points ?? 0}/{SCORE_MAX[k]}:</strong> {parts[k]?.note ?? ""}</li>
                      ))}
                      <li>Found with the search: <em>{o.query as string}</em>. The kind is a guess from this phrase. No Domain Authority or traffic data is used.</li>
                    </ul>
                  </details>
                  <OpportunityActions id={o.id as string} status={o.status as string} note={(o.note as string | null) ?? null} />
                </li>
              );
            })}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
            {f.page > 1 && <Link href={`/dashboard/opportunities${qs({ page: f.page - 1 > 1 ? f.page - 1 : null })}`} className="underline">← Previous</Link>}
            <span className="text-muted">Page {f.page} of {pages}</span>
            {f.page < pages && <Link href={`/dashboard/opportunities${qs({ page: f.page + 1 })}`} className="underline">Next →</Link>}
          </nav>
        )}
      </section>
    </div>
  );
}
