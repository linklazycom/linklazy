import Link from "next/link";
import { MetricChip } from "@/components/ui/metric-chip";
import { Money } from "@/components/currency/money";
import { SellerTierBadge } from "@/components/reviews/seller-tier-badge";
import { DrBadge } from "@/components/sites/dr-badge";
import { SiteHighlightBadges } from "@/components/sites/site-highlight-badges";
import { cn } from "@/lib/utils";

export interface SiteCardData {
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
  accepts_paid?: boolean;
  pay_per_view_enabled?: boolean;
  view_price?: number | null;
  is_featured?: boolean | null;
  created_at?: string | null;
}

interface Props {
  site: SiteCardData;
  href: string;
  sellerTier: string | null;
  /** Seller's public display name, shown as a byline under the domain. */
  sellerName?: string | null;
  /** Seller's average rating + review count, shown next to the name. */
  sellerRating?: { avg: number; count: number } | null;
  /** Link target for the seller name/rating byline — usually /profile/[owner_id]. */
  sellerHref?: string;
  /** Shown instead of the real domain when the buyer hasn't unlocked yet. */
  displayDomain?: string;
  ctaLabel?: string;
  /** Extra content slotted below the CTA — used for the bulk-select checkbox, watchlist button, etc. */
  actions?: React.ReactNode;
  /** Rendered before the domain — used for the bulk-order checkbox. */
  leading?: React.ReactNode;
}

/**
 * The single shared card used everywhere a site is listed (public browse,
 * dashboard browse, bulk-order selector). Redesigned from the old flat
 * metric-chip row: highlight badges up top, domain + seller tier as the
 * clear header, metrics grouped in a lightweight grid, price pulled out
 * as its own accent line so it doesn't get lost among DA/DR/traffic.
 */
export function SiteCard({
  site,
  href,
  sellerTier,
  sellerName,
  sellerRating,
  sellerHref,
  displayDomain,
  ctaLabel = "View Site",
  actions,
  leading,
}: Props) {
  const isFeatured = Boolean(site.is_featured);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-chip border bg-white p-4 transition-shadow hover:shadow-md",
        isFeatured ? "border-brand-violet/50 ring-1 ring-brand-violet/20" : "border-line"
      )}
    >
      {isFeatured && <div className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />}

      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {leading}
          <span className="truncate font-mono text-base font-medium text-ink">
            {displayDomain ?? site.domain}
          </span>
          <SellerTierBadge tier={sellerTier} />
        </div>
        <SiteHighlightBadges
          isFeatured={isFeatured}
          createdAt={site.created_at}
          da={site.da}
          drVerified={site.dr_verified}
        />
      </div>

      {sellerName && (
        <div className="mb-2.5 -mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          {sellerHref ? (
            <Link href={sellerHref} className="truncate hover:text-ink hover:underline">
              {sellerName}
            </Link>
          ) : (
            <span className="truncate">{sellerName}</span>
          )}
          {sellerRating && sellerRating.count > 0 && (
            <span className="whitespace-nowrap text-amber">
              ★ {sellerRating.avg.toFixed(1)} ({sellerRating.count})
            </span>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <MetricChip label="Niche" value={site.niche} />
        {site.da != null && <MetricChip label="DA" value={site.da} />}
        <DrBadge selfReportedDr={site.dr} verifiedDr={site.dr_verified} />
        {site.organic_traffic != null && (
          <MetricChip label="Traffic" value={`${site.organic_traffic}/mo`} />
        )}
        <MetricChip label="Type" value={site.link_type} />
        {site.accepts_exchange && <MetricChip label="Exchange" value="Available" tone="verified" />}
        {site.pay_per_view_enabled && site.view_price != null && (
          <MetricChip label="Pay-per-view" value={site.view_price} tone="price" />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <div>
          {site.price_amount != null ? (
            <p className="text-sm">
              <span className="font-display text-lg font-medium text-ink">
                <Money amount={Number(site.price_amount)} />
              </span>
              <span className="ml-1 text-xs text-muted">/ order</span>
            </p>
          ) : (
            <p className="text-xs text-muted">Exchange only</p>
          )}
        </div>
        <Link
          href={href}
          className="inline-flex h-9 items-center justify-center rounded-chip border border-line bg-white px-4 text-sm font-medium text-ink transition-colors group-hover:border-ink"
        >
          {ctaLabel}
        </Link>
      </div>

      {actions && <div className="mt-2">{actions}</div>}
    </div>
  );
}
