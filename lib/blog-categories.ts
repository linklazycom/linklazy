export const BLOG_CATEGORIES = [
  "Link Building",
  "Guest Posting",
  "SEO Basics",
  "Site Vetting",
  "Platform Guides",
  "General",
] as const;

const RULES: { category: (typeof BLOG_CATEGORIES)[number]; keywords: string[] }[] = [
  {
    category: "Guest Posting",
    keywords: ["guest post", "guest blogging", "outreach email", "pitch a blog"],
  },
  {
    category: "Link Building",
    keywords: ["backlink", "link building", "anchor text", "link exchange", "referring domain"],
  },
  {
    category: "Site Vetting",
    keywords: ["vet a site", "domain authority", "spam score", "verify ownership", "toxic backlink", "site metrics"],
  },
  {
    category: "SEO Basics",
    keywords: ["seo", "search engine", "keyword research", "organic traffic", "serp"],
  },
  {
    category: "Platform Guides",
    keywords: ["linklazy", "how to use", "dashboard", "escrow", "how it works", "getting started"],
  },
];

/**
 * Suggests a category from title + target keyword using simple keyword
 * matching. This is a starting point for the admin to confirm or override —
 * not meant to auto-categorize without a human glance.
 */
export function suggestCategory(title: string, targetKeyword?: string | null): string {
  const haystack = `${title} ${targetKeyword ?? ""}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => haystack.includes(k))) return rule.category;
  }
  return "General";
}
