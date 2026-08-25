import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com";
  const supabase = await createClient();

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/browse`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/niches`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/blog`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/how-it-works`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/case-studies`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/referrals`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/support`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const { data: articles } = await supabase
    .from("articles")
    .select("slug, category, tags, published_at")
    .eq("status", "published");

  const articlePages: MetadataRoute.Sitemap = (articles ?? []).map((a) => ({
    url: `${siteUrl}/blog/${a.slug}`,
    lastModified: a.published_at ? new Date(a.published_at) : undefined,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const uniqueCategories = [
    ...new Set((articles ?? []).map((a) => a.category).filter((c): c is string => Boolean(c))),
  ];
  const categoryPages: MetadataRoute.Sitemap = uniqueCategories.map((cat) => ({
    url: `${siteUrl}/blog/category/${encodeURIComponent(cat.toLowerCase().replace(/\s+/g, "-"))}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const uniqueTags = [...new Set((articles ?? []).flatMap((a) => a.tags ?? []))];
  const tagPages: MetadataRoute.Sitemap = uniqueTags.map((tag) => ({
    url: `${siteUrl}/blog/tag/${encodeURIComponent(tag)}`,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  const { data: caseStudies } = await supabase
    .from("case_studies")
    .select("slug, created_at")
    .eq("published", true);

  const caseStudyPages: MetadataRoute.Sitemap = (caseStudies ?? []).map((c) => ({
    url: `${siteUrl}/case-studies/${c.slug}`,
    lastModified: c.created_at ? new Date(c.created_at) : undefined,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const { data: sites } = await supabase
    .from("sites")
    .select("id, updated_at")
    .eq("status", "approved");

  const sitePages: MetadataRoute.Sitemap = (sites ?? []).map((s) => ({
    url: `${siteUrl}/browse/${s.id}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : undefined,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const { data: niches } = await supabase
    .from("sites")
    .select("niche")
    .eq("status", "approved");

  const uniqueNiches = [...new Set((niches ?? []).map((n) => n.niche.toLowerCase().trim()))];
  const nichePages: MetadataRoute.Sitemap = uniqueNiches.map((niche) => ({
    url: `${siteUrl}/niches/${encodeURIComponent(niche)}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...articlePages,
    ...categoryPages,
    ...tagPages,
    ...caseStudyPages,
    ...sitePages,
    ...nichePages,
  ];
}
