import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export async function BlogSidebar({ excludeSlug }: { excludeSlug?: string }) {
  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("articles")
    .select("slug, title, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(6);

  const posts = (recent ?? []).filter((a) => a.slug !== excludeSlug).slice(0, 5);

  return (
    <aside className="flex flex-col gap-6">
      <div className="rounded-chip border border-line bg-white p-5">
        <p className="mb-3 text-sm font-medium">Recent articles</p>
        <ul className="flex flex-col gap-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="text-sm text-ink hover:text-brand-violet"
              >
                {post.title}
              </Link>
            </li>
          ))}
          {!posts.length && <li className="text-sm text-muted">No other articles yet.</li>}
        </ul>
      </div>

      <div className="rounded-chip border border-brand-violet/30 bg-brand-soft p-5">
        <p className="mb-2 font-display text-base font-medium">
          Find sites worth linking to
        </p>
        <p className="mb-4 text-sm text-muted">
          Every listing on LinkLazy is ownership-verified with real metrics —
          browse for free, no signup required.
        </p>
        <Link href="/browse">
          <Button size="sm" className="w-full">
            Browse verified sites
          </Button>
        </Link>
      </div>
    </aside>
  );
}
