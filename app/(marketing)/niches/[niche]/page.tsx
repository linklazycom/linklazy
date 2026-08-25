import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { Button } from "@/components/ui/button";
import { maskDomain } from "@/lib/mask-domain";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ niche: string }>;
}): Promise<Metadata> {
  const { niche } = await params;
  const label = decodeURIComponent(niche);
  return {
    title: `${capitalize(label)} Backlink Exchange Sites`,
    description: `Browse verified ${label} niche sites available for backlink exchange or paid placement. Real metrics, ownership-checked listings.`,
  };
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function NicheLandingPage({
  params,
}: {
  params: Promise<{ niche: string }>;
}) {
  const { niche } = await params;
  const label = decodeURIComponent(niche);
  const supabase = await createClient();

  const { data: sites } = await supabase
    .from("sites")
    .select("id, domain, niche, da, dr, organic_traffic, price_amount, link_type, accepts_exchange")
    .eq("status", "approved")
    .ilike("niche", label)
    .order("da", { ascending: false, nullsFirst: false });

  if (!sites?.length) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-brand-violet">
        <Link href="/niches" className="hover:underline">
          Directory
        </Link>{" "}
        / {capitalize(label)}
      </p>
      <h1 className="mb-2 font-display text-3xl font-medium">
        {capitalize(label)} backlink exchange sites
      </h1>
      <p className="mb-10 max-w-xl text-muted">
        {sites.length} verified {label} site{sites.length !== 1 ? "s" : ""} available for
        exchange or paid placement. Every listing is ownership-checked before
        approval.
      </p>

      <div className="space-y-3">
        {sites.map((site) => (
          <div key={site.id} className="rounded-chip border border-line bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono font-medium">{maskDomain(site.domain)}</span>
              {site.accepts_exchange && <MetricChip label="Exchange" value="Available" tone="verified" />}
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {site.da != null && <MetricChip label="DA" value={site.da} />}
              {site.dr != null && <MetricChip label="DR" value={site.dr} />}
              {site.organic_traffic != null && (
                <MetricChip label="Traffic" value={`${site.organic_traffic}/mo`} />
              )}
              {site.price_amount != null && (
                <MetricChip label="Price" value={site.price_amount} tone="price" />
              )}
              <MetricChip label="Type" value={site.link_type} />
            </div>
            <Link href={`/browse/${site.id}`}>
              <Button size="sm" variant="secondary">
                View Site
              </Button>
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-chip border border-line bg-white p-6 text-center">
        <p className="mb-3 text-sm text-muted">
          Have a {label} site? List it and start receiving exchange or paid
          link requests.
        </p>
        <Link href="/register">
          <Button>List your site</Button>
        </Link>
      </div>
    </main>
  );
}
