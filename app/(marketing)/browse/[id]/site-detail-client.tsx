"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";
import { DrBadge } from "@/components/sites/dr-badge";
import { SellerTierBadge } from "@/components/reviews/seller-tier-badge";
import { TrustBadges } from "@/components/reviews/trust-badges";
import { ReviewsList } from "@/components/reviews/reviews-list";
import { AdSlotClient } from "@/components/ads/ad-slot-client";
import { SellerSidebarCard } from "@/components/profile/seller-sidebar-card";
import { RequestLinkForm } from "@/components/orders/request-link-form";
import { maskDomain } from "@/lib/mask-domain";
import { Money } from "@/components/currency/money";
import { FormattedText } from "@/components/ui/formatted-text";

interface SiteDetail {
  id: string;
  url: string;
  domain: string;
  niche: string;
  language: string;
  owner_id: string;
  da: number | null;
  pa: number | null;
  dr: number | null;
  dr_verified: number | null;
  organic_traffic: number | null;
  referring_domains: number | null;
  total_backlinks: number | null;
  indexed_pages: number | null;
  post_count: number | null;
  spam_score: number | null;
  price_amount: number | null;
  accepts_exchange: boolean;
  accepts_paid: boolean;
  link_type: string;
  placement: string;
  turnaround_hours: number;
  guidelines: string | null;
  pay_per_view_enabled: boolean;
  view_price: number | null;
}

interface SellerInfo {
  seller_tier: string | null;
  completion_rate: number | null;
  avg_response_hours: number | null;
  dispute_rate: number | null;
  completed_order_count: number;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export function SiteDetailClient({
  id,
}: {
  id: string;
}) {
  const supabase = createClient();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [quotaViewsLeft, setQuotaViewsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setIsLoggedIn(Boolean(user));
    setCurrentUserId(user?.id ?? null);

    let unlockedNow = false;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_balance, buyer_views_quota, buyer_views_used")
        .eq("id", user.id)
        .single();
      setWalletBalance(profile?.wallet_balance ?? 0);
      // Most buyers have no admin-granted plan (quota 0) — pay-per-view is
      // the only unlock path for them. This just detects the rare case
      // where an admin has granted extra plan views, without ever
      // advertising a self-serve "upgrade" that doesn't exist.
      setQuotaViewsLeft(
        Math.max(0, (profile?.buyer_views_quota ?? 0) - (profile?.buyer_views_used ?? 0))
      );

      const { data: existingQuotaUnlock } = await supabase
        .from("credits_ledger")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "unlock_spend")
        .eq("related_site_id", id)
        .maybeSingle();

      const { data: existingWalletUnlock } = await supabase
        .from("site_unlocks")
        .select("id, expires_at")
        .eq("buyer_id", user.id)
        .eq("site_id", id)
        .order("unlocked_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const walletUnlockActive =
        existingWalletUnlock &&
        (!existingWalletUnlock.expires_at || new Date(existingWalletUnlock.expires_at) > new Date());

      unlockedNow = Boolean(existingQuotaUnlock) || Boolean(walletUnlockActive);
    }
    setUnlocked(unlockedNow);

    const selectFields = unlockedNow
      ? "*"
      : "id, owner_id, niche, da, pa, dr, dr_verified, organic_traffic, price_amount, accepts_exchange, accepts_paid, link_type, pay_per_view_enabled, view_price";
    const { data: s } = await supabase.from("sites").select(selectFields).eq("id", id).single();
    const siteData = s as unknown as SiteDetail;
    setSite(siteData);

    if (siteData?.owner_id) {
      const { data: sellerData } = await supabase
        .from("public_profile_cards")
        .select("seller_tier, completion_rate, avg_response_hours, dispute_rate, completed_order_count, display_name, avatar_url, bio, country")
        .eq("id", siteData.owner_id)
        .single();
      setSeller(sellerData);

      const { data: reviewData } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at")
        .eq("reviewee_id", siteData.owner_id)
        .order("created_at", { ascending: false })
        .limit(20);
      setReviews((reviewData as Review[]) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleUnlock(method: "quota" | "wallet" = "quota") {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/browse/${id}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not unlock this site.");
      return;
    }
    load();
  }

  if (loading || !site) return <main className="mx-auto max-w-2xl px-6 py-16 text-muted">Loading…</main>;

  const canPayPerView = site.pay_per_view_enabled && site.view_price != null;
  const isOwner = Boolean(currentUserId && currentUserId === site.owner_id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <h1 className="mb-1 flex items-center gap-2 font-display text-2xl font-medium">
            {unlocked ? site.domain : maskDomain(site.domain ?? "hidden-site.com")}
            <SellerTierBadge tier={seller?.seller_tier ?? null} />
          </h1>
          {seller && (
            <TrustBadges
              completionRate={seller.completion_rate}
              avgResponseHours={seller.avg_response_hours}
              disputeRate={seller.dispute_rate}
              completedOrderCount={seller.completed_order_count ?? 0}
              className="mb-3 lg:hidden"
            />
          )}

      <div className="mb-6 flex flex-wrap gap-2">
        <MetricChip label="Niche" value={site.niche} />
        {site.da != null && <MetricChip label="DA" value={site.da} />}
        {site.pa != null && <MetricChip label="PA" value={site.pa} />}
        <DrBadge selfReportedDr={site.dr} verifiedDr={site.dr_verified} />
        {site.organic_traffic != null && (
          <MetricChip label="Traffic" value={`${site.organic_traffic}/mo`} />
        )}
        {site.price_amount != null && (
          <MetricChip label="Price" value={site.price_amount} tone="price" />
        )}
        <MetricChip label="Link type" value={site.link_type} />
        <MetricChip
          label="Order type"
          value={
            site.accepts_paid && site.accepts_exchange
              ? "Order or Exchange"
              : site.accepts_paid
                ? "Order (paid)"
                : "Exchange only"
          }
          tone="verified"
        />
      </div>

      {!unlocked && (
        <div className="mb-6 rounded-chip border border-line bg-white p-6 text-center">
          <p className="mb-4 text-sm text-muted">
            {!isLoggedIn
              ? "Log in to see the site URL, referring domains, backlink count, and seller guidelines. Not required to place an order below — DA/DR/traffic and price are already shown above."
              : canPayPerView || quotaViewsLeft > 0
                ? "Unlock this listing to see the site URL, referring domains, backlink count, and seller guidelines. Optional — you can place an order below without unlocking."
                : "This seller hasn't enabled instant unlock for this listing — you can still place an order or exchange request below using the metrics shown above."}
          </p>
          {!isLoggedIn ? (
            <Link href="/register">
              <Button>Log in / Sign up</Button>
            </Link>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {quotaViewsLeft > 0 && (
                <Button onClick={() => handleUnlock("quota")} disabled={busy}>
                  {busy ? "Unlocking…" : `View Site (${quotaViewsLeft} view${quotaViewsLeft === 1 ? "" : "s"} left)`}
                </Button>
              )}
              {canPayPerView && (
                <Button
                  variant={quotaViewsLeft > 0 ? "secondary" : "primary"}
                  onClick={() => handleUnlock("wallet")}
                  disabled={busy || walletBalance < (site.view_price ?? 0)}
                >
                  {busy
                    ? "Unlocking…"
                    : (
                      <>
                        Pay <Money amount={site.view_price ?? 0} /> from wallet
                      </>
                    )}
                </Button>
              )}
            </div>
          )}
          {isLoggedIn && canPayPerView && walletBalance < (site.view_price ?? 0) && (
            <p className="mt-2 text-xs text-muted">
              Wallet balance <Money amount={walletBalance} /> — not enough to pay{" "}
              <Money amount={site.view_price ?? 0} />.{" "}
              <Link href="/dashboard/billing" className="underline">
                Top up
              </Link>
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {unlocked && (
        <>
          <a href={site.url} target="_blank" rel="noreferrer" className="mb-4 block text-sm text-muted underline">
            {site.url}
          </a>
          <div className="mb-6 flex flex-wrap gap-2">
            {site.referring_domains != null && (
              <MetricChip label="Ref. domains" value={site.referring_domains} />
            )}
            {site.total_backlinks != null && (
              <MetricChip label="Backlinks" value={site.total_backlinks} />
            )}
            {site.indexed_pages != null && <MetricChip label="Indexed" value={site.indexed_pages} />}
            {site.post_count != null && <MetricChip label="Posts" value={site.post_count} />}
            {site.spam_score != null && <MetricChip label="Spam score" value={site.spam_score} />}
            <MetricChip label="Placement" value={site.placement} />
            <MetricChip label="Turnaround" value={`${site.turnaround_hours}h`} />
          </div>
          {site.guidelines && (
            <div className="mb-6 rounded-chip border border-line bg-white p-4">
              <p className="mb-2 text-sm font-medium">Seller guidelines</p>
              <FormattedText text={site.guidelines} className="text-sm text-muted" />
            </div>
          )}
        </>
      )}

      {/* Ordering never requires unlocking first — the metrics chips above
          (DA/DR/traffic/price) are already enough to decide, and paying for
          the link is itself the "purchase". Gating it behind a separate
          view-unlock was redundant friction. */}
      {isLoggedIn && !isOwner && (site.accepts_paid || site.accepts_exchange) && (
        <RequestLinkForm
          siteId={site.id}
          acceptsExchange={site.accepts_exchange}
          acceptsPaid={site.accepts_paid}
          priceAmount={site.price_amount}
        />
      )}

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-medium">Seller reviews</h2>
        <ReviewsList reviews={reviews} />
        <AdSlotClient placement="site_detail_bottom" />
      </div>
        </div>

        {seller && site.owner_id && (
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <SellerSidebarCard
              seller={{ id: site.owner_id, ...seller }}
              avgRating={reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null}
              reviewCount={reviews.length}
            />
          </aside>
        )}
      </div>
    </main>
  );
}
