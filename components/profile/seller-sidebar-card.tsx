"use client";

import Link from "next/link";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { SellerTierBadge } from "@/components/reviews/seller-tier-badge";
import { TrustBadges } from "@/components/reviews/trust-badges";

interface SellerSidebarInfo {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  seller_tier: string | null;
  completion_rate: number | null;
  avg_response_hours: number | null;
  dispute_rate: number | null;
  completed_order_count: number;
}

/**
 * Right-rail seller card for a site's detail page — photo, name, tier
 * badge, trust badges, an average-rating summary, and a short bio
 * excerpt, so a buyer can decide whether to trust this seller before
 * ordering without leaving the listing. Links through to the full public
 * profile for the complete review history.
 */
export function SellerSidebarCard({
  seller,
  avgRating,
  reviewCount,
}: {
  seller: SellerSidebarInfo;
  avgRating: number | null;
  reviewCount: number;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <div className="mb-3 flex items-start gap-3">
        <ProfileAvatar url={seller.avatar_url} name={seller.display_name} size={56} />
        <div className="min-w-0">
          <p className="truncate font-medium">{seller.display_name || "LinkLazy seller"}</p>
          {seller.country && <p className="text-xs text-muted">{seller.country}</p>}
          <SellerTierBadge tier={seller.seller_tier} className="mt-1" />
        </div>
      </div>

      {avgRating != null ? (
        <p className="mb-3 text-sm">
          <span className="font-medium text-amber">★ {avgRating.toFixed(1)}</span>{" "}
          <span className="text-muted">({reviewCount} review{reviewCount !== 1 ? "s" : ""})</span>
        </p>
      ) : (
        <p className="mb-3 text-sm text-muted">No reviews yet.</p>
      )}

      <TrustBadges
        completionRate={seller.completion_rate}
        avgResponseHours={seller.avg_response_hours}
        disputeRate={seller.dispute_rate}
        completedOrderCount={seller.completed_order_count ?? 0}
        className="mb-3"
      />

      {seller.bio && <p className="mb-4 line-clamp-3 text-sm text-muted">{seller.bio}</p>}

      <Link href={`/profile/${seller.id}`} className="text-sm font-medium text-brand-blue underline">
        View full profile & reviews →
      </Link>
    </div>
  );
}
