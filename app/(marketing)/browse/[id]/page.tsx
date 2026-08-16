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
import { maskDomain } from "@/lib/mask-domain";
import { Money } from "@/components/currency/money";

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
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export default function PublicSiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const supabase = createClient();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [buyerPlan, setBuyerPlan] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setIsLoggedIn(Boolean(user));

    let unlockedNow = false;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("buyer_plan, wallet_balance")
        .eq("id", user.id)
        .single();
      setBuyerPlan(profile?.buyer_plan ?? "free");
      setWalletBalance(profile?.wallet_balance ?? 0);

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
        .from("profiles")
        .select("seller_tier, completion_rate, avg_response_hours, dispute_rate, completed_order_count")
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

  const isFree = buyerPlan === "free";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
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
          className="mb-3"
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
      </div>

      {!unlocked ? (
        <div className="rounded-chip border border-line bg-white p-6 text-center">
          <p className="mb-4 text-sm text-muted">
            {!isLoggedIn
              ? "Log in to see the site URL, full metrics, seller guidelines, and place an order."
              : isFree && !(site.pay_per_view_enabled && site.view_price != null)
                ? "Upgrade to a paid plan to unlock this listing and place an order."
                : "Unlock this listing to see the site URL, referring domains, backlink count, and seller guidelines."}
          </p>
          {!isLoggedIn ? (
            <Link href="/pricing">
              <Button>Log in / Sign up</Button>
            </Link>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {isFree ? (
                <Link href="/dashboard/billing">
                  <Button>View plans</Button>
                </Link>
              ) : (
                <Button onClick={() => handleUnlock("quota")} disabled={busy}>
                  {busy ? "Unlocking…" : "View Site (1 view)"}
                </Button>
              )}
              {site.pay_per_view_enabled && site.view_price != null && (
                <Button
                  variant="secondary"
                  onClick={() => handleUnlock("wallet")}
                  disabled={busy || walletBalance < site.view_price}
                >
                  {busy
                    ? "Unlocking…"
                    : (
                      <>
                        Pay <Money amount={site.view_price} /> from wallet
                      </>
                    )}
                </Button>
              )}
            </div>
          )}
          {isLoggedIn && site.pay_per_view_enabled && site.view_price != null && walletBalance < site.view_price && (
            <p className="mt-2 text-xs text-muted">
              Wallet balance <Money amount={walletBalance} /> — not enough to pay{" "}
              <Money amount={site.view_price} />.{" "}
              <Link href="/dashboard/billing" className="underline">
                Top up
              </Link>
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      ) : (
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
              <p className="mb-1 text-sm font-medium">Seller guidelines</p>
              <p className="text-sm text-muted">{site.guidelines}</p>
            </div>
          )}
          <Link href={`/dashboard/browse/${site.id}`}>
            <Button size="lg">Request this link</Button>
          </Link>
        </>
      )}

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-medium">Seller reviews</h2>
        <ReviewsList reviews={reviews} />
        <AdSlotClient placement="site_detail_bottom" />
      </div>
    </main>
  );
}
