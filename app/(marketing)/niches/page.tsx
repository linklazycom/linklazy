import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

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
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-brand-violet">
        Directory
      </p>
      <h1 className="mb-2 font-display text-3xl font-medium">Backlink sites by niche</h1>
      <p className="mb-10 max-w-lg text-muted">
        Every listing below is ownership-verified. Pick a niche to see sites
        with metrics, pricing, and exchange availability.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {niches.map(([niche, count]) => (
          <Link
            key={niche}
            href={`/niches/${encodeURIComponent(niche.toLowerCase())}`}
            className="flex items-center justify-between rounded-chip border border-line bg-white p-4 hover:border-brand-violet"
          >
            <span className="font-medium">{niche}</span>
            <span className="font-mono text-xs text-muted">{count} site{count !== 1 ? "s" : ""}</span>
          </Link>
        ))}
        {!niches.length && <p className="text-muted">No approved sites yet.</p>}
      </div>
    </main>
  );
}
