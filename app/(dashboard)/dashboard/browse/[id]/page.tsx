"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";
import { RequestLinkForm } from "@/components/orders/request-link-form";

interface SiteDetail {
  id: string;
  url: string;
  domain: string;
  niche: string;
  language: string;
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

export default function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const supabase = createClient();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function checkUnlockAndLoad() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: existing } = await supabase
      .from("credits_ledger")
      .select("id")
      .eq("user_id", user!.id)
      .eq("type", "unlock_spend")
      .eq("related_site_id", id)
      .maybeSingle();

    if (existing) {
      setUnlocked(true);
      const { data: s } = await supabase.from("sites").select("*").eq("id", id).single();
      setSite(s as SiteDetail);
    } else {
      // Show a metrics-only teaser without the URL/guidelines.
      const { data: s } = await supabase
        .from("sites")
        .select("id, niche, da, pa, dr, organic_traffic, price_amount, accepts_exchange, accepts_paid, link_type")
        .eq("id", id)
        .single();
      setSite(s as SiteDetail);
    }
    setLoading(false);
  }

  useEffect(() => {
    checkUnlockAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleUnlock() {
    setError(null);
    const res = await fetch(`/api/browse/${id}/unlock`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not unlock this site.");
      return;
    }
    checkUnlockAndLoad();
  }

  if (loading || !site) return <p className="text-muted">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-medium">
        {unlocked ? site.domain : "Site details"}
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
            Unlock this listing to see the site URL, referring domains,
            backlink count, seller guidelines, and to place an order. This
            uses one of your plan&apos;s monthly views.
          </p>
          <Button onClick={handleUnlock}>Unlock (1 view)</Button>
          {error && (
            <p className="mt-3 text-sm text-red-600">
              {error}{" "}
              <Link href="/dashboard/billing" className="underline">
                View plans
              </Link>
            </p>
          )}
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
          <RequestLinkForm
            siteId={site.id}
            acceptsExchange={site.accepts_exchange}
            acceptsPaid={site.accepts_paid}
          />
        </>
      )}
    </div>
  );
}
