"use client";

import Link from "next/link";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { TrustBadges } from "@/components/reviews/trust-badges";
import { SellerTierBadge } from "@/components/reviews/seller-tier-badge";

interface CounterpartyInfo {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  role: string;
  seller_tier: string | null;
  completion_rate: number | null;
  avg_response_hours: number | null;
  dispute_rate: number | null;
  completed_order_count: number;
}

/**
 * Compact profile summary used where a party needs to size up the other
 * side of an order before committing — currently the seller's
 * accept/reject screen for a newly-placed order. Shows seller trust
 * badges only when the counterparty actually has a seller role, since a
 * pure buyer has no completion_rate/dispute_rate worth showing.
 */
export function CounterpartyCard({
  profile,
  avgRating,
  reviewCount,
}: {
  profile: CounterpartyInfo;
  avgRating: number | null;
  reviewCount: number;
}) {
  const showSellerStats = profile.role === "seller" || profile.role === "both";

  return (
    <div className="rounded-chip border border-line bg-white p-4">
      <div className="mb-3 flex items-start gap-3">
        <ProfileAvatar url={profile.avatar_url} name={profile.display_name} size={48} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium">
            {profile.display_name || "LinkLazy member"}
            {showSellerStats && <SellerTierBadge tier={profile.seller_tier} />}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            {profile.country && <span>{profile.country}</span>}
            {avgRating != null && (
              <span className="text-amber">★ {avgRating.toFixed(1)} ({reviewCount})</span>
            )}
          </div>
        </div>
      </div>

      {showSellerStats && (
        <TrustBadges
          completionRate={profile.completion_rate}
          avgResponseHours={profile.avg_response_hours}
          disputeRate={profile.dispute_rate}
          completedOrderCount={profile.completed_order_count ?? 0}
          className="mb-3"
        />
      )}

      {profile.bio && <p className="mb-3 line-clamp-2 text-sm text-muted">{profile.bio}</p>}

      <Link href={`/profile/${profile.id}`} className="text-sm font-medium text-brand-blue underline">
        View full profile & reviews →
      </Link>
    </div>
  );
}
