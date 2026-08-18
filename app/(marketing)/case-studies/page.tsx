import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Case Studies",
  description: "Real results from buyers and sellers using LinkLazy.",
};

export default async function CaseStudiesPage() {
  const supabase = await createClient();
  const { data: studies } = await supabase
    .from("case_studies")
    .select("slug, title, summary, metric_before, metric_after, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  return (
    <main>
      <PageHero
        eyebrow="Real results"
        eyebrowIcon={TrendingUp}
        title="Case studies"
        description="How buyers and sellers on LinkLazy have grown their sites."
      />

      <div className="mx-auto max-w-6xl px-6 py-16">
        {!studies?.length && (
          <p className="text-muted">
            No case studies published yet — check back soon.
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          {studies?.map((s) => (
            <Link
              key={s.slug}
              href={`/case-studies/${s.slug}`}
              className="rounded-chip border border-line bg-white p-6 shadow-sm transition-all hover:border-brand-violet/40 hover:shadow-md"
            >
              <h2 className="mb-2 font-display text-lg font-medium">{s.title}</h2>
              <p className="mb-3 text-sm leading-relaxed text-muted line-clamp-3">{s.summary}</p>
              {s.metric_before && s.metric_after && (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-signal">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {s.metric_before} → {s.metric_after}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
