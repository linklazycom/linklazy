import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";

export default async function AdminSitesQueuePage() {
  const supabase = await createClient();
  const { data: sites } = await supabase
    .from("sites")
    .select(
      "id, domain, niche, status, da, dr, organic_traffic, owner_id, created_at, profiles:owner_id(full_name)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Site approvals</h1>

      {!sites?.length && (
        <p className="text-muted">No sites waiting for review.</p>
      )}

      <div className="space-y-3">
        {sites?.map((site) => (
          <Link
            key={site.id}
            href={`/admin/sites/${site.id}`}
            className="block rounded-chip border border-line bg-white p-4 hover:border-ink"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">{site.domain}</span>
              <span className="text-xs text-muted">
                {new Date(site.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <MetricChip label="Niche" value={site.niche} />
              {site.da != null && <MetricChip label="DA" value={site.da} />}
              {site.dr != null && <MetricChip label="DR" value={site.dr} />}
              {site.organic_traffic != null && (
                <MetricChip label="Traffic" value={`${site.organic_traffic}/mo`} />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
