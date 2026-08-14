import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArticleCardGrid } from "@/components/blog/article-card-grid";

function slugToLabel(slug: string) {
  return decodeURIComponent(slug)
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const label = slugToLabel(category);
  return {
    title: `${label} articles`,
    description: `LinkLazy blog articles in the ${label} category.`,
  };
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const label = slugToLabel(category);

  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("slug, title, meta_description, target_keyword, category, published_at")
    .eq("status", "published")
    .ilike("category", label)
    .order("published_at", { ascending: false });

  if (!articles?.length) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link href="/blog" className="mb-4 inline-block text-sm text-muted hover:text-ink">
        ← All articles
      </Link>
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-brand-violet">Category</p>
      <h1 className="mb-8 font-display text-3xl font-medium">{label}</h1>
      <ArticleCardGrid articles={articles} />
    </main>
  );
}
