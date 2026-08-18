import Link from "next/link";
import type { Metadata } from "next";
import { LayoutGrid, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Backlink Sites by Niche",
  description: "Browse verified backlink exchange sites organized by niche — find relevant, topically-matched sites for your link building.",
};

export default async function NichesIndexPage() {
  const supabase = await createClient();
  const { data: sites } = await supabase
    .from("sites")
    .select("niche")
    .eq("status", "approved");

  const counts = new Map<string, number>();
  for (const s of sites ?? []) {
    const key = s.niche.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const niches = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <main>
      <PageHero
        eyebrow="Directory"
        eyebrowIcon={LayoutGrid}
        title="Backlink sites by niche"
        description="Every listing below is ownership-verified. Pick a niche to see sites with metrics, pricing, and exchange availability."
      />

      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {niches.map(([niche, count]) => (
            <Link
              key={niche}
              href={`/niches/${encodeURIComponent(niche.toLowerCase())}`}
              className="group flex items-center justify-between rounded-chip border border-line bg-white p-4 shadow-sm transition-all hover:border-brand-violet/40 hover:shadow-md"
            >
              <span className="font-medium text-ink">{niche}</span>
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
                {count} site{count !== 1 ? "s" : ""}
                <ArrowRight className="h-3.5 w-3.5 text-line transition-colors group-hover:text-brand-violet" />
              </span>
            </Link>
          ))}
          {!niches.length && <p className="text-muted">No approved sites yet.</p>}
        </div>
      </div>
    </main>
  );
}
