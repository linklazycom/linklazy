"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { WatchlistButton } from "@/components/watchlist/watchlist-button";
import { SiteCard, type SiteCardData } from "@/components/sites/site-card";

const MAX_BULK = 10;

/**
 * Same shared SiteCard as the rest of Browse Sites, but with a checkbox
 * (for sites that accept paid orders) rendered before the domain name, and
 * a floating bar that appears once something's selected. Selecting sites
 * reveals the bar to jump to the bulk order review page with the
 * selection carried in the URL.
 */
export function BulkOrderSelector({
  sites,
  tierByOwner,
  nameByOwner,
  ratingByOwner,
  currentUserId,
}: {
  sites: SiteCardData[];
  tierByOwner: Map<string, string | null>;
  nameByOwner?: Map<string, string | null>;
  ratingByOwner?: Map<string, { avg: number; count: number }>;
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
      <div className="grid gap-4 sm:grid-cols-2">
        {sites.map((site) => {
          const canBulk = site.accepts_paid && site.owner_id !== currentUserId;
          return (
            <SiteCard
              key={site.id}
              site={site}
              href={`/dashboard/browse/${site.id}`}
              sellerTier={tierByOwner.get(site.owner_id) ?? null}
              sellerName={nameByOwner?.get(site.owner_id)}
              sellerRating={ratingByOwner?.get(site.owner_id) ?? null}
              sellerHref={`/profile/${site.owner_id}`}
              actions={<WatchlistButton siteId={site.id} />}
              leading={
                canBulk ? (
                  <input
                    type="checkbox"
                    checked={selected.has(site.id)}
                    onChange={() => toggle(site.id)}
                    disabled={!selected.has(site.id) && selected.size >= MAX_BULK}
                    title="Select for bulk order"
                  />
                ) : undefined
              }
            />
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
