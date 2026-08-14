import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";

export default async function AdminCaseStudiesPage() {
  const supabase = await createClient();
  const { data: studies } = await supabase
    .from("case_studies")
    .select("id, slug, title, published, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Case studies</h1>
        <Link href="/admin/case-studies/new">
          <Button size="sm">New case study</Button>
        </Link>
      </div>

      <div className="space-y-3">
        {studies?.map((s) => (
          <Link
            key={s.id}
            href={`/admin/case-studies/${s.id}`}
            className="block rounded-chip border border-line bg-white p-4 hover:border-brand-violet"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{s.title}</span>
              <MetricChip label={s.published ? "Published" : "Draft"} value={s.slug} tone={s.published ? "verified" : "default"} />
            </div>
          </Link>
        ))}
        {!studies?.length && (
          <p className="text-muted">
            No case studies yet — add a real one once you have verifiable
            results to share.
          </p>
        )}
      </div>
    </div>
  );
}
