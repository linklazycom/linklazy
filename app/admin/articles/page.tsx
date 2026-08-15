import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";

export default async function AdminArticlesPage() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, slug, status, target_keyword, category, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Blog articles</h1>
        <Link href="/admin/articles/new">
          <Button>New article</Button>
        </Link>
      </div>

      <Link
        href="/admin/articles/categorize"
        className="mb-6 inline-block text-sm text-brand-blue underline"
      >
        Bulk-categorize old articles →
      </Link>

      <div className="space-y-3">
        {articles?.map((article) => (
          <Link
            key={article.id}
            href={`/admin/articles/${article.id}`}
            className="block rounded-chip border border-line bg-white p-4 hover:border-ink"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium">{article.title}</span>
              <div className="flex gap-2">
                <MetricChip label="Category" value={article.category ?? "General"} />
                <MetricChip
                  label="Status"
                  value={article.status}
                  tone={article.status === "published" ? "verified" : "price"}
                />
              </div>
            </div>
            <p className="text-xs text-muted">/blog/{article.slug}</p>
            {article.target_keyword && (
              <p className="mt-1 text-xs text-muted">Keyword: {article.target_keyword}</p>
            )}
          </Link>
        ))}
        {!articles?.length && <p className="text-muted">No articles yet.</p>}
      </div>
    </div>
  );
}
