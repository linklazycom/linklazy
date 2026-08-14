import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { marked } from "marked";
import { createClient } from "@/lib/supabase/server";
import { ArticleCover } from "@/components/blog/article-cover";
import { BlogSidebar } from "@/components/blog/blog-sidebar";
import { searchPexelsPhoto } from "@/lib/pexels";

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
    .select("title, content, target_keyword, meta_description, category, tags, published_at, updated_at")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!article) notFound();

  const [html, photo] = await Promise.all([
    marked.parse(article.content),
    searchPexelsPhoto(article.target_keyword || article.title),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com";

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.meta_description ?? undefined,
    image: photo?.url ?? `${siteUrl}/logo.png`,
    datePublished: article.published_at ?? undefined,
    dateModified: article.updated_at ?? article.published_at ?? undefined,
    author: { "@type": "Organization", name: "LinkLazy" },
    publisher: {
      "@type": "Organization",
      name: "LinkLazy",
      logo: { "@type": "ImageObject", url: `${siteUrl}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${siteUrl}/blog/${slug}` },
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {photo ? (
        <div className="relative h-64 w-full md:h-80">
          <Image src={photo.url} alt={photo.alt} fill className="object-cover" unoptimized priority />
        </div>
      ) : (
        <ArticleCover seed={slug} className="h-64 w-full object-cover md:h-80" />
      )}
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[1fr_280px]">
        <div className="max-w-2xl">
          {article.category && (
            <Link
              href={`/blog/category/${encodeURIComponent(article.category.toLowerCase().replace(/\s+/g, "-"))}`}
              className="mb-3 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-violet"
            >
              {article.category}
            </Link>
          )}
          <h1 className="mb-2 font-display text-3xl font-medium">{article.title}</h1>
          {article.published_at && (
            <p className="mb-4 text-xs text-muted">
              {new Date(article.published_at).toLocaleDateString()}
            </p>
          )}
          <div className="article-content" dangerouslySetInnerHTML={{ __html: html }} />

          {article.tags?.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2 border-t border-line pt-6">
              {article.tags.map((tag: string) => (
                <Link
                  key={tag}
                  href={`/blog/tag/${encodeURIComponent(tag)}`}
                  className="rounded-full border border-line px-2 py-1 text-xs text-muted hover:border-brand-violet hover:text-brand-violet"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="hidden lg:block">
          <BlogSidebar excludeSlug={slug} />
        </div>
        <div className="lg:hidden">
          <BlogSidebar excludeSlug={slug} />
        </div>
      </div>
    </main>
  );
}
