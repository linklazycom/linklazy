import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { marked } from "marked";
import { createClient } from "@/lib/supabase/server";
import { ArticleCover } from "@/components/blog/article-cover";
import { BlogSidebar } from "@/components/blog/blog-sidebar";
import { searchPexelsPhoto, searchPexelsPhotos } from "@/lib/pexels";
import { injectInlineImages } from "@/lib/article-images";
import { sanitizeArticleHtml } from "@/lib/sanitize-html";

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

  // Some rows can have an empty/missing body (e.g. a draft that only ever
  // got a title and metadata) — render the rest of the page normally
  // instead of crashing the whole route on `.split()`/`marked.parse()`
  // with `content: null`.
  const hasContent = typeof article.content === "string" && article.content.trim().length > 0;

  const wordCount = hasContent ? article.content.split(/\s+/).filter(Boolean).length : 0;
  const inlineImageCount = Math.min(4, Math.max(0, Math.floor(wordCount / 450)));

  const [rawHtml, photo, inlinePhotos] = await Promise.all([
    hasContent ? marked.parse(article.content) : Promise.resolve(""),
    searchPexelsPhoto(article.target_keyword || article.title, slug),
    inlineImageCount > 0
      ? searchPexelsPhotos(article.target_keyword || article.title, inlineImageCount, slug)
      : Promise.resolve([]),
  ]);

  const html = hasContent ? sanitizeArticleHtml(injectInlineImages(rawHtml as string, inlinePhotos)) : "";

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
          <h1 className="mb-4 font-display text-3xl font-medium">{article.title}</h1>
          {hasContent ? (
            <div className="article-content" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="text-muted">
              This article&apos;s content isn&apos;t published yet — check back soon.
            </p>
          )}

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
