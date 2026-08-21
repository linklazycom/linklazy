import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ArticleCardGrid } from "@/components/blog/article-card-grid";
import { Pagination } from "@/components/blog/pagination";

const PAGE_SIZE = 10;

// Every published article is fetched with .range() below (10 at a time)
// instead of the old unbounded .select() — keeps each page load small
// and fast, and gives every page a real, crawlable /blog?page=N URL
// (better for SEO/indexing than an infinite-scroll "load more" pattern,
// which search engines have to execute JS to discover).
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://linklazy.com";
  const canonical = pageNum > 1 ? `${siteUrl}/blog?page=${pageNum}` : `${siteUrl}/blog`;

  return {
    title: pageNum > 1 ? `Blog — Page ${pageNum}` : "Blog",
    description:
      "Guides on link building, guest posting, and growing organic traffic through backlink exchange.",
    alternates: { canonical },
  };
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const [{ data: articles, count }, { data: allCategories }] = await Promise.all([
    supabase
      .from("articles")
      .select("slug, title, meta_description, target_keyword, category, tags, published_at", {
        count: "exact",
      })
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(from, to),
    // Categories still need the full set (just one column) to build the
    // filter chips — this is a much lighter query than pulling every
    // article's full row for the same purpose.
    supabase.from("articles").select("category").eq("status", "published"),
  ]);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const categories = Array.from(
    new Set((allCategories ?? []).map((a) => a.category || "General"))
  ).sort();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-brand-violet">
        Resources
      </p>
      <h1 className="mb-2 font-display text-3xl font-medium">Blog</h1>
      <p className="mb-6 max-w-lg text-muted">
        Practical guides on link building, guest posting, and site vetting —
        no fluff, no filler.
      </p>

      {categories.length > 1 && (
        <div className="mb-10 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/blog/category/${encodeURIComponent(cat.toLowerCase().replace(/\s+/g, "-"))}`}
              className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-ink hover:border-brand-violet"
            >
              {cat}
            </Link>
          ))}
        </div>
      )}

      <ArticleCardGrid articles={articles ?? []} />

      <Pagination basePath="/blog" currentPage={currentPage} totalPages={totalPages} />
    </main>
  );
}
