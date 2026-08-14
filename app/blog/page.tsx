import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ArticleCardGrid } from "@/components/blog/article-card-grid";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides on link building, guest posting, and growing organic traffic through backlink exchange.",
};

export default async function BlogIndexPage() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("slug, title, meta_description, target_keyword, category, tags, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const categories = Array.from(
    new Set((articles ?? []).map((a) => a.category || "Uncategorized"))
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
              href={cat === "Uncategorized" ? "/blog" : `/blog/category/${encodeURIComponent(cat.toLowerCase().replace(/\s+/g, "-"))}`}
              className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-ink hover:border-brand-violet"
            >
              {cat}
            </Link>
          ))}
        </div>
      )}

      <ArticleCardGrid articles={articles ?? []} />
    </main>
  );
}

