import { createClient } from "@/lib/supabase/server";
import { ArticleForm } from "@/components/admin/article-form";
import { notFound } from "next/navigation";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: article } = await supabase.from("articles").select("*").eq("id", id).single();

  if (!article) notFound();

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Edit article</h1>
      <ArticleForm
        initial={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          meta_description: article.meta_description ?? "",
          target_keyword: article.target_keyword ?? "",
          content: article.content,
          status: article.status,
        }}
      />
    </div>
  );
}
