import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MetricChip } from "@/components/ui/metric-chip";

export default async function SellerAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: sites } = await supabase
    .from("sites")
    .select("id, domain, status")
    .eq("owner_id", user.id);

  if (!sites?.length) {
    return (
      <div>
        <h1 className="mb-2 font-display text-2xl font-medium">My site analytics</h1>
        <p className="text-muted">List a site first to see its performance here.</p>
      </div>
    );
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const siteIds = sites.map((s) => s.id);

  // Ownership of every siteId above was just verified against the logged-in
  // user via the session client. The service client below only reads
  // aggregate view/unlock counts for those already-verified site ids — it
  // never takes site ids from user input, so this doesn't expose other
  // sellers' data. (page_views/credits_ledger RLS is admin-only, and a
  // text-matching RLS policy on the `path` string would be fragile, so
  // this read happens server-side instead.)
  const serviceClient = createServiceClient();

  const { data: views } = await serviceClient
    .from("page_views")
    .select("path")
    .gte("created_at", since.toISOString())
    .or(siteIds.map((id) => `path.ilike.%${id}%`).join(","));

  const { data: unlocks } = await serviceClient
    .from("credits_ledger")
    .select("related_site_id")
    .eq("type", "unlock_spend")
    .in("related_site_id", siteIds)
    .gte("created_at", since.toISOString());

  const viewCounts = new Map<string, number>();
  for (const id of siteIds) {
    viewCounts.set(id, (views ?? []).filter((v) => v.path.includes(id)).length);
  }
  const unlockCounts = new Map<string, number>();
  for (const u of unlocks ?? []) {
    unlockCounts.set(u.related_site_id, (unlockCounts.get(u.related_site_id) ?? 0) + 1);
  }

  const maxViews = Math.max(1, ...siteIds.map((id) => viewCounts.get(id) ?? 0));

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-medium">My site analytics</h1>
      <p className="mb-6 text-sm text-muted">Last 30 days — views and unlocks per listing.</p>

      <div className="space-y-4">
        {sites.map((site) => {
          const viewCount = viewCounts.get(site.id) ?? 0;
          const unlockCount = unlockCounts.get(site.id) ?? 0;
          const conversion = viewCount > 0 ? ((unlockCount / viewCount) * 100).toFixed(1) : "0.0";

          return (
            <div key={site.id} className="rounded-chip border border-line bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-medium">{site.domain}</span>
                <div className="flex gap-2">
                  <MetricChip label="Views" value={viewCount} />
                  <MetricChip label="Unlocks" value={unlockCount} tone="verified" />
                  <MetricChip label="Conversion" value={`${conversion}%`} tone="price" />
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
                <div
                  className="h-full bg-brand-gradient"
                  style={{ width: `${Math.max(4, (viewCount / maxViews) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-muted">
        Views are counted from page visits to your listing's detail page.
        Unlocks count buyers who spent a credit to see your contact info —
        a low view-to-unlock ratio usually means your listing's metrics or
        price need a second look.
      </p>
    </div>
  );
}
