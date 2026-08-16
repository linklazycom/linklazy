"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  wallet_balance: number;
}

const TOPUP_AMOUNTS = [100, 300, 500, 1000];

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
  const [couponCode, setCouponCode] = useState("");
  const [topupAmount, setTopupAmount] = useState<number | "">("");
  const [topupBusy, setTopupBusy] = useState(false);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("profiles")
      .select(
        "role, buyer_plan, buyer_views_quota, buyer_views_used, buyer_plan_renews_at, seller_plan, wallet_balance"
      )
      .eq("id", user!.id)
      .single();
    setProfile(data as Profile);
  }

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const walletStatus = params.get("wallet");
    if (walletStatus === "success") setWalletMessage("Wallet topped up successfully.");
    else if (walletStatus === "error") setWalletMessage("Top-up failed. Please try again.");
    else if (walletStatus === "cancelled") setWalletMessage("Top-up was cancelled.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function topUpWallet(provider: "bkash" | "paypal") {
    if (!topupAmount || topupAmount < 50) {
      setError("Minimum top-up is ৳50.");
      return;
    }
    setTopupBusy(true);
    setError(null);
    const res = await fetch("/api/wallet/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: topupAmount, provider }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not start top-up.");
      setTopupBusy(false);
      return;
    }
    window.location.href = body.redirectUrl;
  }

  async function subscribe(kind: "buyer" | "seller", plan: string) {
    setBusyPlan(plan);
    setError(null);
    const res = await fetch("/api/billing/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        plan,
        coupon_code: couponCode.trim() || undefined,
      }),
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

      {walletMessage && (
        <p className="mb-4 rounded-chip border border-line bg-white px-3 py-2 text-sm">{walletMessage}</p>
      )}

      <div className="mb-10 max-w-md rounded-chip border border-line bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-lg font-medium">Wallet</h2>
          <Link href="/dashboard/wallet" className="text-sm text-brand-blue underline">
            View history
          </Link>
        </div>
        <p className="mb-3 text-sm text-muted">
          Load your wallet to pay per-site for listings owners have enabled for pay-per-view — no
          subscription needed. Also used to pay out your earnings if you're a seller.
        </p>
        <div className="mb-3">
          <MetricChip label="Balance" value={profile.wallet_balance} tone="price" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {TOPUP_AMOUNTS.map((amt) => (
            <Button
              key={amt}
              size="sm"
              variant={topupAmount === amt ? "primary" : "secondary"}
              onClick={() => setTopupAmount(amt)}
            >
              ৳{amt}
            </Button>
          ))}
          <input
            type="number"
            min={50}
            max={50000}
            value={topupAmount}
            onChange={(e) => setTopupAmount(e.target.value ? Number(e.target.value) : "")}
            placeholder="Custom amount"
            className="w-32 rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-signal"
          />
          <Button size="sm" onClick={() => topUpWallet("bkash")} disabled={topupBusy}>
            {topupBusy ? "Redirecting…" : "Top up with bKash"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => topUpWallet("paypal")} disabled={topupBusy}>
            {topupBusy ? "Redirecting…" : "Top up with PayPal"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          bKash charges in BDT. PayPal charges in USD at the platform exchange rate.
        </p>
      </div>

      <div className="mb-6 max-w-xs">
        <label htmlFor="coupon" className="mb-1 block text-sm text-muted">
          Coupon code (optional)
        </label>
        <input
          id="coupon"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          placeholder="e.g. WELCOME20"
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
        <p className="mt-1 text-xs text-muted">Applied automatically when you choose a plan below.</p>
      </div>

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
