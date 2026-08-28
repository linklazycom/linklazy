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
      .select(
        "site_id, created_at, sites(id, owner_id, domain, niche, da, dr, organic_traffic, price_amount, status)"
      )
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    getUnlockedSiteIds(supabase, user!.id),
  ]);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-medium">Watchlist</h1>

      <div className="space-y-3">
        {watched?.map((w) => {
          const site = w.sites as unknown as {
            id: string;
            owner_id: string;
            domain: string;
            niche: string;
            da: number | null;
            dr: number | null;
            organic_traffic: number | null;
            price_amount: number | null;
            status: string;
          } | null;
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
