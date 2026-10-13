import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { maskDomain } from "@/lib/mask-domain";
import { getUnlockedSiteIds } from "@/lib/unlocked-sites";

export default async function WatchlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: watched }, unlockedIds] = await Promise.all([
    supabase
      .from("watchlists")
      .select("site_id, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    getUnlockedSiteIds(supabase, user!.id),
  ]);

  // Site details come from the sites_public view (domain is masked unless the
  // viewer owns/unlocked the site) instead of a direct sites(...) join.
  type WatchSite = {
    id: string;
    owner_id: string;
    domain: string;
    niche: string;
    da: number | null;
    dr: number | null;
    organic_traffic: number | null;
    price_amount: number | null;
    status: string;
  };
  const watchedIds = (watched ?? []).map((w) => w.site_id as string);
  const sitesById = new Map<string, WatchSite>();
  if (watchedIds.length > 0) {
    const { data: siteRows } = await supabase
      .from("sites_public")
      .select("id, owner_id, domain, niche, da, dr, organic_traffic, price_amount, status")
      .in("id", watchedIds);
    (siteRows ?? []).forEach((s) => sitesById.set(s.id as string, s as unknown as WatchSite));
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Watchlist</h1>

      <div className="space-y-3">
        {watched?.map((w) => {
          const site = sitesById.get(w.site_id as string);
          if (!site) return null;
          const unlocked = site.owner_id === user!.id || unlockedIds.has(site.id);
          return (
            <Link
              key={w.site_id}
              href={`/dashboard/browse/${site.id}`}
              className="block rounded-chip border border-line bg-white p-4 hover:border-ink"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{unlocked ? site.domain : maskDomain(site.domain)}</span>
                {site.status !== "approved" && (
                  <MetricChip label="Status" value={site.status} />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <MetricChip label="Niche" value={site.niche} />
                {site.da != null && <MetricChip label="DA" value={site.da} />}
                {site.dr != null && <MetricChip label="DR" value={site.dr} />}
                {site.organic_traffic != null && (
                  <MetricChip label="Traffic" value={`${site.organic_traffic}/mo`} />
                )}
                {site.price_amount != null && (
                  <MetricChip label="Price" value={site.price_amount} tone="price" />
                )}
              </div>
            </Link>
          );
        })}
        {!watched?.length && (
          <p className="text-muted">
            Nothing saved yet. Tap &quot;Watch&quot; on any listing while
            browsing to keep track of it here.
          </p>
        )}
      </div>
    </div>
  );
}
