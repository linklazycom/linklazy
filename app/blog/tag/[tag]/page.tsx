import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArticleCardGrid } from "@/components/blog/article-card-grid";
import { Pagination } from "@/components/blog/pagination";

const PAGE_SIZE = 10;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const { page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const label = decodeURIComponent(tag);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://linklazy.com";
  const basePath = `/blog/tag/${tag}`;
  const canonical = pageNum > 1 ? `${siteUrl}${basePath}?page=${pageNum}` : `${siteUrl}${basePath}`;

  return {
    title: pageNum > 1 ? `#${label} articles — Page ${pageNum}` : `#${label} articles`,
    description: `LinkLazy blog articles tagged ${label}.`,
    alternates: { canonical },
  };
}

export default async function BlogTagPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { tag } = await params;
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const label = decodeURIComponent(tag);

  const supabase = await createClient();
  const { data: articles, count } = await supabase
    .from("articles")
    .select("slug, title, meta_description, target_keyword, category, tags, published_at", {
      count: "exact",
    })
    .eq("status", "published")
    .contains("tags", [label])
    .order("published_at", { ascending: false })
    .range(from, to);

  if (!count) notFound();

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link href="/blog" className="mb-4 inline-block text-sm text-muted hover:text-ink">
        ← All articles
      </Link>
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-brand-violet">Tag</p>
      <h1 className="mb-8 font-display text-3xl font-medium">#{label}</h1>
      <ArticleCardGrid articles={articles ?? []} />
      <Pagination basePath={`/blog/tag/${tag}`} currentPage={currentPage} totalPages={totalPages} />
    </main>
  );
}
