import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ContentStudio, type StudioDoc } from "@/components/content/studio";
import { ContentDeleteButton } from "@/components/content/delete-button";
import { KIND_DEFS, isContentKind } from "@/lib/content/kinds";
import { isUuid } from "@/lib/content/documents";

export const metadata = { title: "AI Content Studio" };

export default async function ContentStudioPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const { doc: docParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: projects }, { data: docs, error }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("user_id", user.id).order("name", { ascending: true }).limit(50),
    supabase.from("content_documents").select("id, kind, title, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(200),
  ]);
  if (error) throw new Error("Could not load documents");

  let initialDoc: StudioDoc | null = null;
  if (docParam && isUuid(docParam)) {
    const { data } = await supabase.from("content_documents").select("id, kind, title, body, project_id").eq("id", docParam).eq("user_id", user.id).maybeSingle();
    if (data && isContentKind(data.kind)) initialDoc = { id: data.id, kind: data.kind, title: data.title, body: data.body, project_id: data.project_id };
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium">AI Content Studio</h1>
        <p className="text-sm text-muted">Draft outreach emails, bios, article ideas, outlines, titles and more. You edit, you publish: nothing is posted or sent for you.</p>
      </div>

      <ContentStudio key={initialDoc?.id ?? "new"} projects={projects ?? []} initialDoc={initialDoc} />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Saved documents</h2>
        {(docs ?? []).length === 0 ? (
          <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">Nothing saved yet. Write a draft above, edit it and press Save.</p>
        ) : (
          <ul className="divide-y divide-line rounded-chip border border-line bg-white">
            {(docs ?? []).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <Link href={`/dashboard/content?doc=${d.id}`} className="font-medium underline">
                    {d.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {isContentKind(d.kind) ? KIND_DEFS[d.kind].label : d.kind} · {new Date(d.updated_at).toISOString().slice(0, 10)}
                  </p>
                </div>
                <ContentDeleteButton id={d.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
