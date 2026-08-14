import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArticleCardGrid } from "@/components/blog/article-card-grid";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const label = decodeURIComponent(tag);
  return {
    title: `#${label} articles`,
    description: `LinkLazy blog articles tagged ${label}.`,
  };
}

export default async function BlogTagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const label = decodeURIComponent(tag);

  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("slug, title, meta_description, target_keyword, category, tags, published_at")
    .eq("status", "published")
    .contains("tags", [label])
    .order("published_at", { ascending: false });

  if (!articles?.length) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link href="/blog" className="mb-4 inline-block text-sm text-muted hover:text-ink">
        ← All articles
      </Link>
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-brand-violet">Tag</p>
      <h1 className="mb-8 font-display text-3xl font-medium">#{label}</h1>
      <ArticleCardGrid articles={articles} />
    </main>
  );
}
