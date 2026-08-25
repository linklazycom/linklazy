import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { marked } from "marked";
import { createClient } from "@/lib/supabase/server";
import { sanitizeArticleHtml } from "@/lib/sanitize-html";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: study } = await supabase
    .from("case_studies")
    .select("title, summary")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!study) return {};
  return { title: study.title, description: study.summary };
}

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: study } = await supabase
    .from("case_studies")
    .select("title, summary, content, metric_before, metric_after, created_at")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!study) notFound();

  const html = sanitizeArticleHtml(await marked.parse(study.content) as string);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com";

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: study.title,
    description: study.summary,
    datePublished: study.created_at,
    author: { "@type": "Organization", name: "LinkLazy" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${siteUrl}/case-studies/${slug}` },
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-brand-violet">Case study</p>
      <h1 className="mb-4 font-display text-3xl font-medium">{study.title}</h1>
      {study.metric_before && study.metric_after && (
        <div className="mb-8 inline-block rounded-chip bg-brand-soft px-4 py-2 text-sm font-medium text-brand-violet">
          {study.metric_before} → {study.metric_after}
        </div>
      )}
      <div className="article-content" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
