import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ArticleCover } from "@/components/blog/article-cover";
import { searchPexelsPhoto } from "@/lib/pexels";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides on link building, guest posting, and growing organic traffic through backlink exchange.",
};

export default async function BlogIndexPage() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("slug, title, meta_description, target_keyword, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const withPhotos = await Promise.all(
    (articles ?? []).map(async (article) => ({
      ...article,
      photo: await searchPexelsPhoto(article.target_keyword || article.title),
    }))
  );

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
        {withPhotos.map((article) => (
          <Link
            key={article.slug}
            href={`/blog/${article.slug}`}
            className="group overflow-hidden rounded-chip border border-line bg-white transition-shadow hover:shadow-md"
          >
            {article.photo ? (
              <div className="relative aspect-[600/315] w-full overflow-hidden">
                <Image
                  src={article.photo.url}
                  alt={article.photo.alt}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  unoptimized
                />
              </div>
            ) : (
              <ArticleCover seed={article.slug} className="aspect-[600/315] w-full" />
            )}
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
        {!withPhotos.length && <p className="text-muted">No articles published yet.</p>}
      </div>
    </main>
  );
}
