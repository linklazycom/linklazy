import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/projects/project-form";
import { ProjectDeleteButton } from "@/components/projects/project-delete-button";
import { getLinkLimits, shortUrlFor } from "@/lib/links/server";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, name, canonical_url, domain, description, niche, country, language, competitors, notes, created_at")
    .eq("id", id)
    .maybeSingle();
  // Admins can read every project through RLS, but this page is the owner's workspace.
  if (!project || project.user_id !== user.id) notFound();

  const [{ data: keywords }, { data: links, count: linkCount }, limits, { data: profile }] = await Promise.all([
    supabase.from("project_keywords").select("keyword").eq("project_id", id).order("created_at", { ascending: true }),
    supabase
      .from("short_links")
      .select("id, slug, title, click_count, is_active, disabled_reason", { count: "exact" })
      .eq("user_id", user.id)
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    getLinkLimits(),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);
  const isAdmin = profile?.role === "admin";

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href="/dashboard/projects" className="text-sm text-muted underline">
          ← All projects
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium">{project.name}</h1>
        <a href={project.canonical_url} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-mono text-sm text-brand-violet underline">
          {project.canonical_url}
        </a>
      </div>

      <ProjectForm
        mode="edit"
        projectId={project.id}
        maxKeywords={isAdmin ? 500 : limits.project_max_keywords}
        initial={{
          name: project.name,
          url: project.canonical_url,
          description: project.description ?? "",
          niche: project.niche ?? "",
          country: project.country ?? "",
          language: project.language ?? "",
          keywords: (keywords ?? []).map((k) => k.keyword).join("\n"),
          competitors: (project.competitors ?? []).join("\n"),
          notes: project.notes ?? "",
        }}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-medium">Short links in this project</h2>
          <Link href={`/dashboard/links?project=${project.id}`}>
            <Button size="sm" variant="secondary" type="button">
              {linkCount ? "View all & add a link" : "Add a short link"}
            </Button>
          </Link>
        </div>
        {!links?.length ? (
          <p className="text-sm text-muted">No short links are attached to this project yet. You can pick the project when you create or edit a short link.</p>
        ) : (
          <ul className="divide-y divide-line rounded-chip border border-line bg-white">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <Link href={`/dashboard/links/${l.id}`} className="min-w-0">
                  <span className="font-medium">{l.title || l.slug}</span>{" "}
                  <span className="break-all font-mono text-xs text-muted">{shortUrlFor(l.slug)}</span>
                  {l.disabled_reason ? <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">Disabled</span> : !l.is_active ? <span className="ml-2 rounded-full bg-line/60 px-2 py-0.5 text-xs text-muted">Off</span> : null}
                </Link>
                <span className="font-mono text-xs text-muted">{l.click_count} clicks</span>
              </li>
            ))}
          </ul>
        )}
        {(linkCount ?? 0) > 10 && <p className="text-xs text-muted">Showing the 10 newest of {linkCount}.</p>}
      </section>

      <section className="space-y-2 border-t border-line pt-6">
        <h2 className="font-display text-lg font-medium">Delete this project</h2>
        <p className="text-sm text-muted">Removes the project and its keywords. Your short links are kept.</p>
        <ProjectDeleteButton id={project.id} name={project.name} linkCount={linkCount ?? 0} />
      </section>
    </div>
  );
}
