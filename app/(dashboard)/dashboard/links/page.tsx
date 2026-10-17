import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkCreateForm } from "@/components/links/link-create-form";
import { LinkRowActions } from "@/components/links/link-row-actions";
import { CopyButton } from "@/components/links/copy-button";
import { linkStatus } from "@/lib/links/rules";
import { safeSearchTerm } from "@/lib/links/fields";
import { effectiveCaps } from "@/lib/links/limits";
import { getLinkLimits, isLinkFeatureOn, shortUrlFor, siteUrl } from "@/lib/links/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Short links" };

const PAGE_SIZE = 20;
const STATUSES = ["all", "active", "inactive", "expired", "taken_down"] as const;

const STATUS_STYLE: Record<string, string> = {
  active: "bg-signal-soft text-signal",
  inactive: "bg-line/60 text-muted",
  expired: "bg-amber-soft text-amber",
  limit_reached: "bg-amber-soft text-amber",
  taken_down: "bg-red-50 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  inactive: "Off",
  expired: "Expired",
  limit_reached: "Limit reached",
  taken_down: "Disabled",
};

type SP = { q?: string; status?: string; folder?: string; tag?: string; project?: string; page?: string };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LinksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (!(await isLinkFeatureOn())) {
    return (
      <div>
        <h1 className="mb-2 font-display text-2xl font-medium">Short links</h1>
        <p className="text-muted">Link management is temporarily turned off. Please check back soon.</p>
      </div>
    );
  }

  const q = safeSearchTerm(sp.q);
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? (sp.status as (typeof STATUSES)[number]) : "all";
  const folder = (sp.folder ?? "").slice(0, 40);
  const tag = (sp.tag ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
  const projectFilter = UUID_RE.test(sp.project ?? "") ? (sp.project as string) : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("short_links")
    .select("id, slug, destination_url, title, folder, project_id, tags, is_active, has_password, expires_at, max_clicks, click_count, disabled_reason, created_at", { count: "exact" })
    .eq("user_id", user.id);

  if (q) query = query.or(`slug.ilike.%${q}%,title.ilike.%${q}%,destination_url.ilike.%${q}%`);
  if (folder) query = query.eq("folder", folder);
  if (tag) query = query.contains("tags", [tag]);
  if (projectFilter) query = query.eq("project_id", projectFilter);
  if (status === "active") query = query.eq("is_active", true).is("disabled_reason", null).or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (status === "inactive") query = query.eq("is_active", false).is("disabled_reason", null);
  if (status === "expired") query = query.lte("expires_at", nowIso);
  if (status === "taken_down") query = query.not("disabled_reason", "is", null);

  const from = (page - 1) * PAGE_SIZE;
  const { data: links, count } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Filter dropdown options + quota meter.
  const [{ data: meta }, limits, { count: allCount }, { data: profile }, { data: projects }] = await Promise.all([
    supabase.from("short_links").select("folder, tags").eq("user_id", user.id).limit(1000),
    getLinkLimits(),
    supabase.from("short_links").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("projects").select("id, name").eq("user_id", user.id).order("name", { ascending: true }).limit(200),
  ]);
  const projectNames = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const folders = Array.from(new Set((meta ?? []).map((m) => m.folder).filter((f): f is string => !!f))).sort();
  const tagsAll = Array.from(new Set((meta ?? []).flatMap((m) => m.tags ?? []))).sort();
  const caps = effectiveCaps(limits, user.created_at);
  const isAdmin = profile?.role === "admin";

  const params = { q: q || undefined, status: status === "all" ? undefined : status, folder: folder || undefined, tag: tag || undefined, project: projectFilter || undefined };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium">Short links</h1>
          <p className="text-sm text-muted">
            {isAdmin ? `${allCount ?? 0} links` : `${allCount ?? 0} of ${caps.maxLinks} links used`}
            {caps.isNewAccount && !isAdmin ? " (new-account limit)" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/links/import">
            <Button variant="secondary" size="sm">
              Import CSV
            </Button>
          </Link>
          <a href="/api/links/export">
            <Button variant="secondary" size="sm" type="button">
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      <LinkCreateForm siteUrl={siteUrl()} projects={projects ?? []} defaultProjectId={projectFilter && projectNames.has(projectFilter) ? projectFilter : null} />

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-chip border border-line bg-white p-4">
        <div>
          <label htmlFor="q" className="mb-1 block text-xs text-muted">
            Search
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="slug, title or URL" className="w-56 rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-signal" />
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-xs text-muted">
            Status
          </label>
          <select id="status" name="status" defaultValue={status} className="rounded-chip border border-line bg-white px-3 py-1.5 text-sm">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Turned off</option>
            <option value="expired">Expired</option>
            <option value="taken_down">Disabled</option>
          </select>
        </div>
        {folders.length > 0 && (
          <div>
            <label htmlFor="folder" className="mb-1 block text-xs text-muted">
              Folder
            </label>
            <select id="folder" name="folder" defaultValue={folder} className="rounded-chip border border-line bg-white px-3 py-1.5 text-sm">
              <option value="">All</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        )}
        {tagsAll.length > 0 && (
          <div>
            <label htmlFor="tag" className="mb-1 block text-xs text-muted">
              Tag
            </label>
            <select id="tag" name="tag" defaultValue={tag} className="rounded-chip border border-line bg-white px-3 py-1.5 text-sm">
              <option value="">All</option>
              {tagsAll.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
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
        {(q || folder || tag || projectFilter || status !== "all") && (
          <Link href="/dashboard/links" className="pb-1.5 text-sm text-muted underline">
            Clear
          </Link>
        )}
      </form>

      {!links?.length ? (
        <EmptyState title={q || folder || tag || projectFilter || status !== "all" ? "No links match these filters" : "No short links yet"} description="Create your first short link above." />
      ) : (
        <div className="space-y-3">
          {links.map((l) => {
            const st = linkStatus(l);
            const short = shortUrlFor(l.slug);
            return (
              <div key={l.id} className="rounded-chip border border-line bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{l.title || l.slug}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS_STYLE[st])}>{STATUS_LABEL[st]}</span>
                      {l.has_password && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-violet">Password</span>}
                      {l.folder && <span className="rounded-full bg-line/60 px-2 py-0.5 text-xs text-muted">📁 {l.folder}</span>}
                      {l.project_id && projectNames.has(l.project_id) && (
                        <Link href={`/dashboard/projects/${l.project_id}`} className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-violet">
                          🗂 {projectNames.get(l.project_id)}
                        </Link>
                      )}
                    </div>
                    <a href={short} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all font-mono text-sm text-brand-violet underline">
                      {short}
                    </a>
                    <p className="mt-1 truncate text-xs text-muted" title={l.destination_url}>
                      → {l.destination_url}
                    </p>
                    {l.tags?.length > 0 && <p className="mt-1 text-xs text-muted">{l.tags.map((t: string) => `#${t}`).join(" ")}</p>}
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p className="font-mono text-base text-ink">
                      {l.click_count}
                      {l.max_clicks ? ` / ${l.max_clicks}` : ""}
                    </p>
                    <p>clicks</p>
                    {l.expires_at && <p className="mt-1">Expires {new Date(l.expires_at).toLocaleDateString()}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <CopyButton text={short} />
                  <LinkRowActions id={l.id} isActive={l.is_active} locked={!!l.disabled_reason} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} basePath="/dashboard/links" params={params} />}
    </div>
  );
}
