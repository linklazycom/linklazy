import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { marked } from "marked";
import { createClient } from "@/lib/supabase/server";
import { ArticleCover } from "@/components/blog/article-cover";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: article } = await supabase
    .from("articles")
    .select("title, meta_description")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!article) return {};

  return {
    title: article.title,
    description: article.meta_description ?? undefined,
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: article } = await supabase
    .from("articles")
    .select("title, content, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!article) notFound();

  const html = await marked.parse(article.content);

  return (
    <main>
      <ArticleCover seed={slug} className="h-64 w-full object-cover md:h-80" />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-2 font-display text-3xl font-medium">{article.title}</h1>
        {article.published_at && (
          <p className="mb-8 text-xs text-muted">
            {new Date(article.published_at).toLocaleDateString()}
          </p>
        )}
        <div className="article-content" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  );
}
