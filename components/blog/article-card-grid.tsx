import Link from "next/link";
import Image from "next/image";
import { ArticleCover } from "@/components/blog/article-cover";
import { searchPexelsPhoto } from "@/lib/pexels";

interface ArticleForCard {
  slug: string;
  title: string;
  meta_description: string | null;
  target_keyword: string | null;
  category: string | null;
  published_at: string | null;
}

export async function ArticleCardGrid({ articles }: { articles: ArticleForCard[] }) {
  const withPhotos = await Promise.all(
    articles.map(async (article) => ({
      ...article,
      photo: await searchPexelsPhoto(article.target_keyword || article.title),
    }))
  );

  if (!withPhotos.length) {
    return <p className="text-muted">No articles here yet.</p>;
  }

  return (
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
            {article.category && (
              <span className="mb-2 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-violet">
                {article.category}
              </span>
            )}
            <h2 className="mb-2 font-display text-lg font-medium group-hover:text-brand-violet">
              {article.title}
            </h2>
            {article.meta_description && (
              <p className="text-sm text-muted line-clamp-2">{article.meta_description}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
