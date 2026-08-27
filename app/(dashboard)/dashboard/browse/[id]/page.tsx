"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";
import { RequestLinkForm } from "@/components/orders/request-link-form";
import { SellerTierBadge } from "@/components/reviews/seller-tier-badge";
import { TrustBadges } from "@/components/reviews/trust-badges";
import { ReviewsList } from "@/components/reviews/reviews-list";
import { WatchlistButton } from "@/components/watchlist/watchlist-button";
import { MessageSellerButton } from "@/components/inquiries/message-seller-button";
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
  response_rate: number | null;
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

export default function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const searchParams = useSearchParams();
  const reorderTarget = searchParams.get("reorder_target") ?? undefined;
  const reorderAnchor = searchParams.get("reorder_anchor") ?? undefined;
  const supabase = createClient();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [quotaViewsLeft, setQuotaViewsLeft] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  async function checkUnlockAndLoad() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    // A site can be unlocked two ways — spending a plan view (credits_ledger,
    // rare: only buyers an admin has manually granted a quota to) or paying
    // per view from the wallet (site_unlocks). Both have to be checked, or
    // wallet-unlocked sites wrongly show as locked again on next visit.
    const [{ data: quotaUnlock }, { data: walletUnlock }] = await Promise.all([
      supabase
        .from("credits_ledger")
        .select("id")
        .eq("user_id", user!.id)
        .eq("type", "unlock_spend")
        .eq("related_site_id", id)
        .maybeSingle(),
      supabase
        .from("site_unlocks")
        .select("id, expires_at")
        .eq("buyer_id", user!.id)
        .eq("site_id", id)
        .order("unlocked_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const walletUnlockActive =
      walletUnlock && (!walletUnlock.expires_at || new Date(walletUnlock.expires_at) > new Date());
    const isUnlocked = Boolean(quotaUnlock) || Boolean(walletUnlockActive);

    let siteData: SiteDetail | null = null;

    if (isUnlocked) {
      setUnlocked(true);
      const { data: s } = await supabase.from("sites").select("*").eq("id", id).single();
      siteData = s as SiteDetail;
    } else {
      // Show a metrics-only teaser without the URL/guidelines.
      const { data: s } = await supabase
        .from("sites")
        .select(
          "id, owner_id, niche, da, pa, dr, organic_traffic, price_amount, accepts_exchange, accepts_paid, link_type, pay_per_view_enabled, view_price"
        )
        .eq("id", id)
        .single();
      siteData = s as SiteDetail;
    }
    setSite(siteData);

    const { data: profile } = await supabase
      .from("profiles")
      .select("buyer_views_quota, buyer_views_used, wallet_balance")
      .eq("id", user!.id)
      .single();
    if (profile) {
      setQuotaViewsLeft(Math.max(0, (profile.buyer_views_quota ?? 0) - (profile.buyer_views_used ?? 0)));
      setWalletBalance(profile.wallet_balance ?? 0);
    }

    if (siteData?.owner_id) {
      const { data: sellerData } = await supabase
        .from("profiles")
        .select("seller_tier, response_rate, completion_rate, avg_response_hours, dispute_rate, completed_order_count")
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
    checkUnlockAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleUnlock(method: "quota" | "wallet") {
    setError(null);
    setUnlocking(true);
    try {
      const res = await fetch(`/api/browse/${id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      // The API can fail before it ever returns JSON (e.g. an unhandled
      // 500 renders an HTML error page) — parse defensively so that case
      // shows a real error instead of silently doing nothing.
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body.error === "string" ? body.error : "Could not unlock this site. Please try again."
        );
        setUnlocking(false);
        return;
      }
      await checkUnlockAndLoad();
    } catch {
      setError("Could not reach the server. Please check your connection and try again.");
    } finally {
      setUnlocking(false);
    }
  }

  if (loading || !site) return <p className="text-muted">Loading…</p>;

  const canPayPerView = site.pay_per_view_enabled && site.view_price != null;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 flex items-center gap-2 font-display text-2xl font-medium">
        {unlocked ? site.domain : "Site details"}
        <SellerTierBadge tier={seller?.seller_tier ?? null} />
      </h1>
      {seller && (
        <TrustBadges
          completionRate={seller.completion_rate}
          avgResponseHours={seller.avg_response_hours}
          disputeRate={seller.dispute_rate}
          completedOrderCount={seller.completed_order_count ?? 0}
          className="mb-3"
        />
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <WatchlistButton siteId={site.id} />
        {currentUserId && site.owner_id !== currentUserId && (
          <MessageSellerButton siteId={site.id} />
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <MetricChip label="Niche" value={site.niche} />
        {site.da != null && <MetricChip label="DA" value={site.da} />}
        {site.pa != null && <MetricChip label="PA" value={site.pa} />}
        {site.dr != null && <MetricChip label="DR" value={site.dr} />}
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
        <div className="mb-6 rounded-chip border border-line bg-white p-4 text-center">
          <p className="mb-3 text-sm text-muted">
            {canPayPerView || quotaViewsLeft > 0
              ? "Unlock this listing to see the site URL, referring domains, backlink count, and seller guidelines. Optional — you can place an order below without unlocking."
              : "This seller hasn't enabled instant unlock for this listing — you can still place an order or exchange request below using the metrics shown above."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {quotaViewsLeft > 0 && (
              <Button size="sm" variant="secondary" onClick={() => handleUnlock("quota")} disabled={unlocking}>
                {unlocking ? "Unlocking…" : `Unlock full details (${quotaViewsLeft} view${quotaViewsLeft === 1 ? "" : "s"} left)`}
              </Button>
            )}
            {canPayPerView && (
              <Button
                size="sm"
                variant={quotaViewsLeft > 0 ? "ghost" : "secondary"}
                onClick={() => handleUnlock("wallet")}
                disabled={unlocking || walletBalance < (site.view_price ?? 0)}
              >
                {unlocking ? "Unlocking…" : `Pay ৳${site.view_price} from wallet`}
              </Button>
            )}
          </div>
          {canPayPerView && walletBalance < (site.view_price ?? 0) && (
            <p className="mt-2 text-xs text-muted">
              Wallet balance ৳{walletBalance} isn&apos;t enough to cover this —{" "}
              <Link href="/dashboard/billing" className="underline">
                top up
              </Link>
              .
            </p>
          )}
          {error && (
            <div className="mt-3 rounded-chip border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
              <p>{error}</p>
            </div>
          )}
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

      {/* Ordering never requires unlocking first — the buyer already has
          enough (DA/DR/traffic/price) from the metrics chips above to
          decide, and paying for the link is itself the "purchase";
          gating it behind a separate view-quota spend was redundant
          friction (and confusingly looked like a broken button). */}
      {(site.accepts_paid || site.accepts_exchange) && site.owner_id !== currentUserId && (
        <RequestLinkForm
          siteId={site.id}
          acceptsExchange={site.accepts_exchange}
          acceptsPaid={site.accepts_paid}
          priceAmount={site.price_amount}
          defaultTargetUrl={reorderTarget}
          defaultAnchorText={reorderAnchor}
        />
      )}

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-medium">Seller reviews</h2>
        <ReviewsList reviews={reviews} />
      </div>
    </div>
  );
}
