import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getLinkLimits } from "@/lib/links/server";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: projects, error }, limits, { data: profile }] = await Promise.all([
    supabase.from("projects").select("id, name, canonical_url, domain, niche, country, language, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    getLinkLimits(),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);
  if (error) throw new Error("Could not load projects");

  const isAdmin = profile?.role === "admin";
  const list = projects ?? [];
  const max = limits.project_max_per_user;
  const canCreate = isAdmin || (max > 0 && list.length < max);

  // Per-project counts (small lists: at most a few projects per user).
  const ids = list.map((p) => p.id);
  const kwCount = new Map<string, number>();
  const linkCount = new Map<string, number>();
  if (ids.length > 0) {
    const [{ data: kws }, { data: lnks }] = await Promise.all([
      supabase.from("project_keywords").select("project_id").in("project_id", ids).limit(5000),
      supabase.from("short_links").select("project_id").eq("user_id", user.id).in("project_id", ids).limit(5000),
    ]);
    for (const k of kws ?? []) kwCount.set(k.project_id, (kwCount.get(k.project_id) ?? 0) + 1);
    for (const l of lnks ?? []) if (l.project_id) linkCount.set(l.project_id, (linkCount.get(l.project_id) ?? 0) + 1);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium">Projects</h1>
          <p className="text-sm text-muted">
            One project per website you promote. Keep its niche, keywords and competitors in one place.
            {isAdmin ? ` ${list.length} projects.` : max > 0 ? ` ${list.length} of ${max} used.` : ""}
          </p>
        </div>
        {canCreate && (
          <Link href="/dashboard/projects/new">
            <Button size="sm" type="button">
              New project
            </Button>
          </Link>
        )}
      </div>

      {max === 0 && !isAdmin ? (
        <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">Projects are not available right now.</p>
      ) : list.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Add the website you want to promote to get started."
          action={
            <Link href="/dashboard/projects/new">
              <Button size="sm" type="button">
                Create your first project
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="block rounded-chip border border-line bg-white p-4 transition-colors hover:bg-paper">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="break-all font-mono text-xs text-brand-violet">{p.canonical_url}</p>
                  <p className="mt-1 text-xs text-muted">
                    {[p.niche, p.country, p.language].filter(Boolean).join(" · ") || "No niche, country or language set"}
                  </p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p>
                    {kwCount.get(p.id) ?? 0} keyword{(kwCount.get(p.id) ?? 0) === 1 ? "" : "s"}
                  </p>
                  <p>
                    {linkCount.get(p.id) ?? 0} short link{(linkCount.get(p.id) ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
