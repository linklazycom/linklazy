import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { SellerTierBadge } from "@/components/reviews/seller-tier-badge";
import { TrustBadges } from "@/components/reviews/trust-badges";
import { ReviewsList } from "@/components/reviews/reviews-list";
import { FormattedText } from "@/components/ui/formatted-text";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { SiteCard, type SiteCardData } from "@/components/sites/site-card";
import { Pagination } from "@/components/blog/pagination";
import { maskDomain } from "@/lib/mask-domain";

const SITES_PER_PAGE = 10;

interface PublicProfile {
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

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

async function getSellerSites(id: string, page: number) {
  const supabase = await createClient();

  const from = (page - 1) * SITES_PER_PAGE;
  const to = from + SITES_PER_PAGE - 1;

  const { data: sites, count } = await supabase
    .from("sites")
    .select(
      "id, owner_id, domain, niche, da, dr, dr_verified, organic_traffic, price_amount, link_type, accepts_exchange, accepts_paid, pay_per_view_enabled, view_price, is_featured, created_at",
      { count: "exact" }
    )
    .eq("owner_id", id)
    .eq("status", "approved")
    .order("is_featured", { ascending: false })
    .order("da", { ascending: false, nullsFirst: false })
    .range(from, to);

  // Mirror Browse Sites: a logged-in visitor who has already unlocked a
  // listing sees the real domain instead of the masked one.
  let unlockedIds = new Set<string>();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: unlocks } = await supabase
      .from("credits_ledger")
      .select("related_site_id")
      .eq("user_id", user.id)
      .eq("type", "unlock_spend");
    unlockedIds = new Set((unlocks ?? []).map((u) => u.related_site_id));
  }

  return {
    sites: (sites as SiteCardData[]) ?? [],
    unlockedIds,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / SITES_PER_PAGE)),
  };
}

async function getProfile(id: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("public_profile_cards")
    .select("*")
    .eq("id", id)
    .single();

  if (!profile) return null;

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at")
    .eq("reviewee_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  return { profile: profile as PublicProfile, reviews: (reviews as Review[]) ?? [] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getProfile(id);
  if (!data) return { title: "Profile not found — LinkLazy" };

  const name = data.profile.display_name || "LinkLazy member";
  return {
    title: `${name} — LinkLazy`,
    description: data.profile.bio?.slice(0, 160) || `${name}'s profile on LinkLazy.`,
  };
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const data = await getProfile(id);
  if (!data) notFound();

  const { profile, reviews } = data;
  const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;
  const isSeller = profile.role === "seller" || profile.role === "both";
  const isBuyer = profile.role === "buyer" || profile.role === "both";

  const currentPage = Math.max(1, Number(pageParam) || 1);
  const sellerSites = isSeller ? await getSellerSites(id, currentPage) : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-6 flex items-start gap-4">
        <ProfileAvatar url={profile.avatar_url} name={profile.display_name} size={72} />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-medium">
            {profile.display_name || "LinkLazy member"}
            {isSeller && <SellerTierBadge tier={profile.seller_tier} />}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {profile.country && <span>{profile.country}</span>}
            <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium">
              {isSeller && isBuyer ? "Buyer & Seller" : isSeller ? "Seller" : "Buyer"}
            </span>
            {avgRating != null && (
              <span className="text-amber">★ {avgRating.toFixed(1)} ({reviews.length})</span>
            )}
          </div>
        </div>
      </div>

      {isSeller && (
        <TrustBadges
          completionRate={profile.completion_rate}
          avgResponseHours={profile.avg_response_hours}
          disputeRate={profile.dispute_rate}
          completedOrderCount={profile.completed_order_count ?? 0}
          className="mb-6"
        />
      )}

      {profile.bio && (
        <div className="mb-8 rounded-chip border border-line bg-white p-4">
          <p className="mb-2 text-sm font-medium">About</p>
          <FormattedText text={profile.bio} className="text-sm text-muted" />
        </div>
      )}

      {isSeller && (profile.completed_order_count ?? 0) > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <MetricChip label="Completed orders" value={profile.completed_order_count} tone="verified" />
        </div>
      )}

      {isSeller && sellerSites && sellerSites.sites.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 font-display text-lg font-medium">Sites listed by this seller</h2>
          <div className="grid gap-4">
            {sellerSites.sites.map((site) => {
              const unlocked = sellerSites.unlockedIds.has(site.id);
              return (
                <SiteCard
                  key={site.id}
                  site={site}
                  href={`/browse/${site.id}`}
                  sellerTier={profile.seller_tier}
                  displayDomain={unlocked ? site.domain : maskDomain(site.domain)}
                  ctaLabel={unlocked ? "View details" : "View Site"}
                />
              );
            })}
          </div>
          <Pagination basePath={`/profile/${id}`} currentPage={currentPage} totalPages={sellerSites.totalPages} />
        </div>
      )}

      <div>
        <h2 className="mb-3 font-display text-lg font-medium">Reviews</h2>
        <ReviewsList reviews={reviews} />
      </div>
    </main>
  );
}
