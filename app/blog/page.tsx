import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ArticleCover } from "@/components/blog/article-cover";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides on link building, guest posting, and growing organic traffic through backlink exchange.",
};

export default async function BlogIndexPage() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("slug, title, meta_description, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-brand-violet">
        Resources
      </p>
      <h1 className="mb-2 font-display text-3xl font-medium">Blog</h1>
      <p className="mb-10 max-w-lg text-muted">
        Practical guides on link building, guest posting, and site vetting —
        no fluff, no filler.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        {articles?.map((article) => (
          <Link
            key={article.slug}
            href={`/blog/${article.slug}`}
            className="group overflow-hidden rounded-chip border border-line bg-white transition-shadow hover:shadow-md"
          >
            <ArticleCover seed={article.slug} className="aspect-[600/315] w-full" />
            <div className="p-5">
              <h2 className="mb-2 font-display text-lg font-medium group-hover:text-brand-violet">
                {article.title}
              </h2>
              {article.meta_description && (
                <p className="mb-3 text-sm text-muted line-clamp-2">{article.meta_description}</p>
              )}
              {article.published_at && (
                <p className="text-xs text-muted">
                  {new Date(article.published_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </Link>
        ))}
        {!articles?.length && <p className="text-muted">No articles published yet.</p>}
      </div>
    </main>
  );
}
