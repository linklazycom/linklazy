"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";
import { SellerTierBadge } from "@/components/reviews/seller-tier-badge";
import { WatchlistButton } from "@/components/watchlist/watchlist-button";
import { DrBadge } from "@/components/sites/dr-badge";

interface SiteCard {
  id: string;
  owner_id: string;
  domain: string;
  niche: string;
  da: number | null;
  dr: number | null;
  dr_verified: number | null;
  organic_traffic: number | null;
  price_amount: number | null;
  link_type: string;
  accepts_exchange: boolean;
  accepts_paid: boolean;
}

const MAX_BULK = 10;

/**
 * Renders the same site cards as before, but with a checkbox for sites
 * that accept paid orders (bulk order only supports "paid" — exchange
 * orders need a per-site buyer_site_id pick, which doesn't fit a batch
 * flow cleanly). Selecting sites reveals a floating bar to jump to the
 * bulk order review page with the selection carried in the URL.
 */
export function BulkOrderSelector({
  sites,
  tierByOwner,
  currentUserId,
}: {
  sites: SiteCard[];
  tierByOwner: Map<string, string | null>;
  currentUserId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_BULK) {
        next.add(id);
      }
      return next;
    });
  }

  function reviewBulkOrder() {
    router.push(`/dashboard/browse/bulk-order?ids=${[...selected].join(",")}`);
  }

  return (
    <div className="pb-20">
      <div className="space-y-3">
        {sites.map((site) => {
          const canBulk = site.accepts_paid && site.owner_id !== currentUserId;
          return (
            <div key={site.id} className="rounded-chip border border-line bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono font-medium">
                  {canBulk && (
                    <input
                      type="checkbox"
                      checked={selected.has(site.id)}
                      onChange={() => toggle(site.id)}
                      disabled={!selected.has(site.id) && selected.size >= MAX_BULK}
                      title="Select for bulk order"
                    />
                  )}
                  {site.domain}
                  <SellerTierBadge tier={tierByOwner.get(site.owner_id) ?? null} />
                </span>
                <WatchlistButton siteId={site.id} />
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <MetricChip label="Niche" value={site.niche} />
                {site.da != null && <MetricChip label="DA" value={site.da} />}
                <DrBadge selfReportedDr={site.dr} verifiedDr={site.dr_verified} />
                {site.organic_traffic != null && (
                  <MetricChip label="Traffic" value={`${site.organic_traffic}/mo`} />
                )}
                {site.price_amount != null && (
                  <MetricChip label="Price" value={site.price_amount} tone="price" />
                )}
                <MetricChip label="Type" value={site.link_type} />
              </div>
              <Link href={`/dashboard/browse/${site.id}`}>
                <Button size="sm" variant="secondary">
                  View Site
                </Button>
              </Link>
            </div>
          );
        })}
        {!sites.length && <p className="text-muted">No sites match these filters.</p>}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-white p-4 shadow-lg md:left-64">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <p className="text-sm">
              {selected.size} site{selected.size > 1 ? "s" : ""} selected (max {MAX_BULK})
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelected(new Set())}
                className="text-sm text-muted underline"
              >
                Clear
              </button>
              <Button size="sm" onClick={reviewBulkOrder}>
                Review bulk order →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
