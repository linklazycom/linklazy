import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CaseStudyForm } from "@/components/dashboard/case-study-form";

export default async function EditCaseStudyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: study } = await supabase
    .from("case_studies")
    .select("id, slug, title, summary, content, metric_before, metric_after, published")
    .eq("id", id)
    .single();

  if (!study) notFound();

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Edit case study</h1>
      <CaseStudyForm
        initial={{
          id: study.id,
          slug: study.slug,
          title: study.title,
          summary: study.summary,
          content: study.content,
          metric_before: study.metric_before ?? "",
          metric_after: study.metric_after ?? "",
          published: study.published,
        }}
      />
    </div>
  );
}
