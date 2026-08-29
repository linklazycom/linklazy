import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { maskDomain } from "@/lib/mask-domain";
import { Money } from "@/components/currency/money";

export async function BlogSidebar({ excludeSlug }: { excludeSlug?: string }) {
  const supabase = await createClient();

  const [{ data: recent }, { data: freshSites }] = await Promise.all([
    supabase
      .from("articles")
      .select("slug, title, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(6),
    // Real, live marketplace listings, not just a static CTA — gives a
    // reader an actual reason to click through instead of a generic
    // "browse sites" box with nothing to look at.
    supabase
      .from("sites")
      .select("id, domain, niche, da, dr, price_amount")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const posts = (recent ?? []).filter((a) => a.slug !== excludeSlug).slice(0, 5);

  return (
    <aside className="flex h-full flex-col gap-6">
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

      <div className="rounded-chip border border-brand-violet/30 bg-brand-soft p-5 lg:sticky lg:top-20">
        <p className="mb-1 font-display text-base font-medium">Find sites worth linking to</p>
        <p className="mb-4 text-sm text-muted">
          Every listing is ownership-verified with real metrics — browse for free, no signup
          required.
        </p>

        {freshSites && freshSites.length > 0 && (
          <ul className="mb-4 flex flex-col gap-2.5">
            {freshSites.map((site) => (
              <li key={site.id}>
                <Link
                  href={`/browse/${site.id}`}
                  className="block rounded-chip border border-line bg-white p-3 transition-colors hover:border-brand-violet"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 truncate text-sm font-medium text-ink">
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-violet" />
                      {maskDomain(site.domain)}
                    </span>
                    {site.price_amount != null && (
                      <span className="shrink-0 text-xs font-medium text-brand-violet">
                        <Money amount={site.price_amount} />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-2 text-[11px] text-muted">
                    <span className="truncate">{site.niche}</span>
                    {site.da != null && <span>· DA {site.da}</span>}
                    {site.dr != null && <span>· DR {site.dr}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link href="/browse">
          <Button size="sm" className="w-full gap-1.5">
            Browse all sites
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </aside>
  );
}
