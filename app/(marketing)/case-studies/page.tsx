import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-brand-violet">
        Real results
      </p>
      <h1 className="mb-2 font-display text-3xl font-medium">Case Studies</h1>
      <p className="mb-10 max-w-lg text-muted">
        How buyers and sellers on LinkLazy have grown their sites.
      </p>

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
            className="rounded-chip border border-line bg-white p-6 hover:border-brand-violet hover:shadow-md"
          >
            <h2 className="mb-2 font-display text-lg font-medium">{s.title}</h2>
            <p className="mb-3 text-sm text-muted line-clamp-3">{s.summary}</p>
            {s.metric_before && s.metric_after && (
              <p className="text-xs font-medium text-signal">
                {s.metric_before} → {s.metric_after}
              </p>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
