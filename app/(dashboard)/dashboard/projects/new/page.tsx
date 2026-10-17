import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm, EMPTY_PROJECT } from "@/components/projects/project-form";
import { getLinkLimits } from "@/lib/links/server";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [limits, { data: profile }, { count }] = await Promise.all([
    getLinkLimits(),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const isAdmin = profile?.role === "admin";
  const blocked = !isAdmin && (limits.project_max_per_user === 0 || (count ?? 0) >= limits.project_max_per_user);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/projects" className="text-sm text-muted underline">
          ← All projects
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium">New project</h1>
      </div>
      {blocked ? (
        <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">
          {limits.project_max_per_user === 0 ? "Projects are not available right now." : `You've reached your limit of ${limits.project_max_per_user} projects. Delete one to add another.`}
        </p>
      ) : (
        <ProjectForm mode="create" initial={EMPTY_PROJECT} maxKeywords={isAdmin ? 500 : limits.project_max_keywords} />
      )}
    </div>
  );
}
