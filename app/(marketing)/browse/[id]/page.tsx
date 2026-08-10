"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";
import { SellerTierBadge } from "@/components/reviews/seller-tier-badge";
import { ReviewsList } from "@/components/reviews/reviews-list";
import { maskDomain } from "@/lib/mask-domain";

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
}

interface SellerInfo {
  seller_tier: string | null;
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
        .select("buyer_plan")
        .eq("id", user.id)
        .single();
      setBuyerPlan(profile?.buyer_plan ?? "free");

      const { data: existing } = await supabase
        .from("credits_ledger")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "unlock_spend")
        .eq("related_site_id", id)
        .maybeSingle();
      unlockedNow = Boolean(existing);
    }
    setUnlocked(unlockedNow);

    const selectFields = unlockedNow
      ? "*"
      : "id, owner_id, niche, da, pa, dr, organic_traffic, price_amount, accepts_exchange, accepts_paid, link_type";
    const { data: s } = await supabase.from("sites").select(selectFields).eq("id", id).single();
    const siteData = s as unknown as SiteDetail;
    setSite(siteData);

    if (siteData?.owner_id) {
      const { data: sellerData } = await supabase
        .from("profiles")
        .select("seller_tier")
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

  async function handleUnlock() {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/browse/${id}/unlock`, { method: "POST" });
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
      </div>

      {!unlocked ? (
        <div className="rounded-chip border border-line bg-white p-6 text-center">
          <p className="mb-4 text-sm text-muted">
            {!isLoggedIn
              ? "Log in with a paid plan to see the site URL, full metrics, seller guidelines, and place an order."
              : isFree
                ? "Upgrade to a paid plan to unlock this listing and place an order."
                : "Unlock this listing to see the site URL, referring domains, backlink count, and seller guidelines. This uses one of your plan's monthly views."}
          </p>
          {!isLoggedIn ? (
            <Link href="/register">
              <Button>Log in / Sign up</Button>
            </Link>
          ) : isFree ? (
            <Link href="/dashboard/billing">
              <Button>View plans</Button>
            </Link>
          ) : (
            <Button onClick={handleUnlock} disabled={busy}>
              {busy ? "Unlocking…" : "View Site (1 view)"}
            </Button>
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
      </div>
    </main>
  );
}
