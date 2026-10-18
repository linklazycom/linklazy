import Link from "next/link";
import { Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BacklinkAddForm } from "@/components/backlinks/backlink-add-form";
import { CheckNowButton } from "@/components/backlinks/backlink-actions";
import { LinkTypeChips, StatusBadge } from "@/components/backlinks/status-badge";
import { STATUS_LABEL, STATUS_ORDER, reasonText } from "@/lib/backlinks/labels";
import { isBacklinkMonitorOn } from "@/lib/backlinks/feature";
import { getLinkLimits } from "@/lib/links/server";

export const metadata = { title: "Backlink monitor" };

const PAGE_SIZE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type SP = { q?: string; status?: string; project?: string; page?: string };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "never");

export default async function BacklinksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (!(await isBacklinkMonitorOn())) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="font-display text-2xl font-medium">Backlink monitor</h1>
        <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">Backlink monitoring is currently turned off. Please check back later.</p>
      </div>
    );
  }

  const status = STATUS_ORDER.includes(sp.status as never) ? (sp.status as string) : "";
  const projectFilter = UUID_RE.test(sp.project ?? "") ? (sp.project as string) : "";
  const q = (sp.q ?? "").replace(/[%_,()\\*"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  let query = supabase
    .from("backlinks")
    .select("id, project_id, source_url, target_url, status, reason, rel, is_follow, page_robots, found_anchor, last_checked_at, consecutive_failures, monitoring", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (projectFilter) query = query.eq("project_id", projectFilter);
  if (q) query = query.or(`source_url.ilike.%${q}%,target_url.ilike.%${q}%`);

  const [{ data: rows, count, error }, { data: allStatus }, { data: projects }, limits, { data: profile }] = await Promise.all([
    query,
    supabase.from("backlinks").select("status, is_follow").eq("user_id", user.id).limit(5000),
    supabase.from("projects").select("id, name").eq("user_id", user.id).order("name", { ascending: true }).limit(200),
    getLinkLimits(),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);
  if (error) throw new Error("Could not load backlinks");

  const isAdmin = profile?.role === "admin";
  const totalAll = allStatus?.length ?? 0;
  const counts = new Map<string, number>();
  let followActive = 0;
  for (const r of allStatus ?? []) {
    counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    if (r.status === "active" && r.is_follow === true) followActive++;
  }
  const max = limits.backlink_max_per_user;
  const off = max === 0 && !isAdmin;
  const full = !isAdmin && max > 0 && totalAll >= max;
  const names = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!(q || status || projectFilter);
  const params = { q: q || undefined, status: status || undefined, project: projectFilter || undefined };
  const pageHref = (p: number) => {
    const sp2 = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, page: p > 1 ? String(p) : undefined })) if (v) sp2.set(k, v);
    const s = sp2.toString();
    return `/dashboard/backlinks${s ? `?${s}` : ""}`;
  };
  const exportQs = new URLSearchParams(Object.entries({ project: projectFilter, status }).filter(([, v]) => v)).toString();

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium">Backlink monitor</h1>
          <p className="text-sm text-muted">
            Track the pages that should link to you. We check each one every day and tell you what the page&apos;s HTML shows.
            {isAdmin ? ` ${totalAll} tracked.` : max > 0 ? ` ${totalAll} of ${max} used.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/backlinks/import">
            <Button size="sm" variant="secondary" type="button">
              Import CSV
            </Button>
          </Link>
          {totalAll > 0 && (
            <a href={`/api/backlinks/export${exportQs ? `?${exportQs}` : ""}`}>
              <Button size="sm" variant="secondary" type="button">
                Export CSV
              </Button>
            </a>
          )}
        </div>
      </div>

      {off ? (
        <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">Backlink monitoring is not available right now.</p>
      ) : full ? (
        <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">You&apos;ve reached your limit of {max} tracked backlinks. Delete one to add another.</p>
      ) : (
        <BacklinkAddForm projects={projects ?? []} defaultProjectId={projectFilter && names.has(projectFilter) ? projectFilter : null} />
      )}

      {totalAll > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {STATUS_ORDER.filter((s) => counts.get(s)).map((s) => (
            <Link key={s} href={`/dashboard/backlinks?${new URLSearchParams({ ...(projectFilter ? { project: projectFilter } : {}), status: s }).toString()}`} className={`rounded-chip border px-3 py-1 ${status === s ? "border-signal bg-signal-soft" : "border-line bg-white hover:bg-paper"}`}>
              {STATUS_LABEL[s]} · {counts.get(s)}
            </Link>
          ))}
          <span className="rounded-chip border border-line bg-white px-3 py-1 text-muted">Active &amp; follow · {followActive}</span>
        </div>
      )}

      {totalAll > 0 && (
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="q" className="mb-1 block text-xs text-muted">
              Search
            </label>
            <input id="q" name="q" defaultValue={q} placeholder="source or target URL" className="rounded-chip border border-line px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label htmlFor="status" className="mb-1 block text-xs text-muted">
              Status
            </label>
            <select id="status" name="status" defaultValue={status} className="rounded-chip border border-line bg-white px-3 py-1.5 text-sm">
              <option value="">All</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          {(projects?.length ?? 0) > 0 && (
            <div>
              <label htmlFor="project" className="mb-1 block text-xs text-muted">
                Project
              </label>
              <select id="project" name="project" defaultValue={projectFilter} className="rounded-chip border border-line bg-white px-3 py-1.5 text-sm">
                <option value="">All</option>
                {(projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button size="sm" type="submit">
            Filter
          </Button>
          {filtered && (
            <Link href="/dashboard/backlinks" className="text-sm text-muted underline">
              Clear
            </Link>
          )}
        </form>
      )}

      {totalAll === 0 ? (
        <EmptyState icon={Link2} title="No backlinks tracked yet" description="Add a page that should link to your site, or import a CSV of the links you have built." />
      ) : (rows ?? []).length === 0 ? (
        <EmptyState icon={Link2} title="No backlinks match these filters" description="Try a different search or clear the filters." />
      ) : (
        <div className="space-y-3">
          {(rows ?? []).map((b) => (
            <div key={b.id} className="rounded-chip border border-line bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={b.status} />
                    <LinkTypeChips rel={b.rel} isFollow={b.is_follow} pageRobots={b.page_robots} />
                    {b.project_id && names.has(b.project_id) && (
                      <Link href={`/dashboard/projects/${b.project_id}`} className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-violet">
                        🗂 {names.get(b.project_id)}
                      </Link>
                    )}
                    {!b.monitoring && <span className="rounded-full bg-line/60 px-2 py-0.5 text-xs text-muted">Auto-check off</span>}
                  </div>
                  <Link href={`/dashboard/backlinks/${b.id}`} className="block break-all font-mono text-xs text-brand-violet underline">
                    {b.source_url}
                  </Link>
                  <p className="break-all font-mono text-xs text-muted">→ {b.target_url}</p>
                  <p className="text-xs text-muted">
                    Last checked: {fmt(b.last_checked_at)}
                    {b.consecutive_failures > 1 ? ` · ${b.consecutive_failures} checks in a row without an active link` : ""}
                    {b.status !== "active" && b.status !== "unchecked" && reasonText(b.reason) ? ` · ${reasonText(b.reason)}` : ""}
                  </p>
                </div>
                <CheckNowButton id={b.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={pageHref(page - 1)} className="underline">← Newer</Link> : <span />}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={pageHref(page + 1)} className="underline">Older →</Link> : <span />}
        </div>
      )}

      <p className="text-xs text-muted">
        This report shows only what each page&apos;s HTML contained when we checked it. It doesn&apos;t tell you whether search engines count the link or what it is worth. Links that a page adds with JavaScript may not be visible to us.
      </p>
    </div>
  );
}
