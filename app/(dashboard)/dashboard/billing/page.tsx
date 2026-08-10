"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";

interface Profile {
  role: string;
  buyer_plan: string;
  buyer_views_quota: number;
  buyer_views_used: number;
  buyer_plan_renews_at: string | null;
  seller_plan: string | null;
}

const BUYER_PLANS = [
  { id: "starter", name: "Starter", views: 10 },
  { id: "growth", name: "Growth", views: 20 },
  { id: "pro", name: "Pro", views: 50 },
];

export default function BillingPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("profiles")
      .select("role, buyer_plan, buyer_views_quota, buyer_views_used, buyer_plan_renews_at, seller_plan")
      .eq("id", user!.id)
      .single();
    setProfile(data as Profile);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function subscribe(kind: "buyer" | "seller", plan: string) {
    setBusyPlan(plan);
    setError(null);
    const res = await fetch("/api/billing/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, plan }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not start subscription.");
      setBusyPlan(null);
      return;
    }
    if (body.redirectUrl) {
      window.location.href = body.redirectUrl;
      return;
    }
    setBusyPlan(null);
    load();
  }

  if (!profile) return <p className="text-muted">Loading…</p>;

  const canBuy = profile.role === "buyer" || profile.role === "both";
  const canSell = profile.role === "seller" || profile.role === "both";

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-display text-2xl font-medium">Billing</h1>

      {canBuy && (
        <div className="mb-10">
          <h2 className="mb-3 font-display text-lg font-medium">Buyer plan</h2>
          <div className="mb-4 flex gap-2">
            <MetricChip label="Current plan" value={profile.buyer_plan} tone="verified" />
            <MetricChip
              label="Views used"
              value={`${profile.buyer_views_used}/${profile.buyer_views_quota}`}
            />
            {profile.buyer_plan_renews_at && (
              <MetricChip
                label="Renews"
                value={new Date(profile.buyer_plan_renews_at).toLocaleDateString()}
              />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {BUYER_PLANS.map((p) => (
              <div key={p.id} className="rounded-chip border border-line bg-white p-4 text-center">
                <p className="mb-1 font-medium">{p.name}</p>
                <p className="mb-3 text-sm text-muted">{p.views} unlocks/mo</p>
                <Button
                  size="sm"
                  variant={profile.buyer_plan === p.id ? "secondary" : "primary"}
                  className="w-full"
                  disabled={busyPlan === p.id || profile.buyer_plan === p.id}
                  onClick={() => subscribe("buyer", p.id)}
                >
                  {profile.buyer_plan === p.id
                    ? "Current"
                    : busyPlan === p.id
                      ? "Redirecting…"
                      : "Choose"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {canSell && (
        <div>
          <h2 className="mb-3 font-display text-lg font-medium">Seller plan</h2>
          <div className="mb-4">
            <MetricChip
              label="Current plan"
              value={profile.seller_plan ?? "commission"}
              tone="verified"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-chip border border-line bg-white p-4">
              <p className="mb-1 font-medium">Commission plan</p>
              <p className="mb-3 text-sm text-muted">
                No upfront cost — we take a commission only on completed paid
                orders.
              </p>
              <Button size="sm" variant="secondary" className="w-full" disabled>
                {profile.seller_plan === "commission" || !profile.seller_plan
                  ? "Current"
                  : "Default"}
              </Button>
            </div>
            <div className="rounded-chip border border-line bg-white p-4">
              <p className="mb-1 font-medium">Monthly plan</p>
              <p className="mb-3 text-sm text-muted">
                Flat monthly fee, keep 100% of what buyers pay you.
              </p>
              <Button
                size="sm"
                className="w-full"
                disabled={busyPlan === "monthly" || profile.seller_plan === "monthly"}
                onClick={() => subscribe("seller", "monthly")}
              >
                {profile.seller_plan === "monthly"
                  ? "Current"
                  : busyPlan === "monthly"
                    ? "Redirecting…"
                    : "Switch to monthly"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
