import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-2 font-display text-3xl font-medium">Blog</h1>
      <p className="mb-10 text-muted">
        Practical guides on link building, guest posting, and site vetting.
      </p>

      <div className="space-y-8">
        {articles?.map((article) => (
          <article key={article.slug} className="border-b border-line pb-8">
            <Link href={`/blog/${article.slug}`}>
              <h2 className="mb-2 font-display text-xl font-medium hover:underline">
                {article.title}
              </h2>
            </Link>
            {article.meta_description && (
              <p className="text-sm text-muted">{article.meta_description}</p>
            )}
            {article.published_at && (
              <p className="mt-2 text-xs text-muted">
                {new Date(article.published_at).toLocaleDateString()}
              </p>
            )}
          </article>
        ))}
        {!articles?.length && <p className="text-muted">No articles published yet.</p>}
      </div>
    </main>
  );
}
