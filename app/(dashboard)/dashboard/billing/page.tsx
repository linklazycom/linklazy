"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";

interface Profile {
  role: string;
  wallet_balance: number;
}

const TOPUP_AMOUNTS = [100, 300, 500, 1000];

export default function BillingPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topupProvider, setTopupProvider] = useState<"bkash" | "paypal">("bkash");
  const [topupAmount, setTopupAmount] = useState<number | "">(""); // always stored in BDT
  const [topupBusy, setTopupBusy] = useState(false);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const [bdtPerUsd, setBdtPerUsd] = useState(125);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("profiles")
      .select("role, wallet_balance")
      .eq("id", user!.id)
      .single();
    setProfile(data as Profile);
  }

  useEffect(() => {
    load();
    fetch("/api/currency")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.bdt_per_usd) setBdtPerUsd(Number(data.bdt_per_usd));
      })
      .catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const walletStatus = params.get("wallet");
    if (walletStatus === "success") setWalletMessage("Wallet topped up successfully.");
    else if (walletStatus === "error") setWalletMessage("Top-up failed. Please try again.");
    else if (walletStatus === "cancelled") setWalletMessage("Top-up was cancelled.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topupAmountUsd = topupAmount ? Number((Number(topupAmount) / bdtPerUsd).toFixed(2)) : "";
  const topupValid = typeof topupAmount === "number" && topupAmount >= 50 && topupAmount <= 50000;

  async function topUpWallet() {
    if (!topupValid) {
      setError("Minimum top-up is ৳50 (≈$" + (50 / bdtPerUsd).toFixed(2) + ").");
      return;
    }
    setTopupBusy(true);
    setError(null);
    const res = await fetch("/api/wallet/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: topupAmount, provider: topupProvider }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not start top-up.");
      setTopupBusy(false);
      return;
    }
    window.location.href = body.redirectUrl;
  }

  if (!profile) return <p className="text-muted">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-display text-2xl font-medium">Billing</h1>
      <p className="mb-6 text-sm text-muted">
        No subscriptions — LinkLazy is free to join. Sellers list guest posts for free and only
        pay a commission on completed sales; buyers only pay when ordering or unlocking a site.
        This page is for topping up your wallet. To withdraw a seller balance or referral
        credit to bKash, go to{" "}
        <Link href="/dashboard/wallet" className="underline">
          Wallet
        </Link>
        .
      </p>

      {walletMessage && (
        <p className="mb-4 rounded-chip border border-line bg-white px-3 py-2 text-sm">{walletMessage}</p>
      )}

      <div className="max-w-md rounded-chip border border-line bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-lg font-medium">Wallet</h2>
          <Link href="/dashboard/wallet" className="text-sm text-brand-blue underline">
            View history
          </Link>
        </div>
        <p className="mb-3 text-sm text-muted">
          Load your wallet to pay per-site for listings owners have enabled for pay-per-view.
          Also used to pay out your earnings if you're a seller.
        </p>
        <div className="mb-3">
          <MetricChip label="Balance" value={profile.wallet_balance} tone="price" />
        </div>

        <p className="mb-2 text-sm font-medium">Pay with</p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTopupProvider("bkash")}
            className={`rounded-chip border p-3 text-left ${topupProvider === "bkash" ? "border-brand-violet bg-brand-soft" : "border-line"}`}
          >
            <span className="block text-sm font-medium">bKash</span>
            <span className="block text-xs text-muted">Charged in BDT (৳)</span>
          </button>
          <button
            type="button"
            onClick={() => setTopupProvider("paypal")}
            className={`rounded-chip border p-3 text-left ${topupProvider === "paypal" ? "border-brand-violet bg-brand-soft" : "border-line"}`}
          >
            <span className="block text-sm font-medium">PayPal</span>
            <span className="block text-xs text-muted">Charged in USD ($)</span>
          </button>
        </div>

        <p className="mb-2 text-sm font-medium">Amount</p>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {TOPUP_AMOUNTS.map((amt) => (
            <Button
              key={amt}
              size="sm"
              variant={topupAmount === amt ? "primary" : "secondary"}
              onClick={() => setTopupAmount(amt)}
            >
              {topupProvider === "paypal" ? `$${(amt / bdtPerUsd).toFixed(2)}` : `৳${amt}`}
            </Button>
          ))}
          <input
            type="number"
            min={topupProvider === "paypal" ? Number((50 / bdtPerUsd).toFixed(2)) : 50}
            max={topupProvider === "paypal" ? Number((50000 / bdtPerUsd).toFixed(2)) : 50000}
            step={topupProvider === "paypal" ? "0.01" : "1"}
            value={
              topupAmount === ""
                ? ""
                : topupProvider === "paypal"
                  ? topupAmountUsd
                  : topupAmount
            }
            onChange={(e) => {
              const raw = e.target.value ? Number(e.target.value) : "";
              if (raw === "") {
                setTopupAmount("");
              } else if (topupProvider === "paypal") {
                setTopupAmount(Math.round(raw * bdtPerUsd));
              } else {
                setTopupAmount(Math.round(raw));
              }
            }}
            placeholder={topupProvider === "paypal" ? "Custom amount (USD)" : "Custom amount (BDT)"}
            className="w-40 rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-signal"
          />
        </div>
        {topupAmount !== "" && (
          <p className="mb-3 text-xs text-muted">
            {topupProvider === "paypal"
              ? `You'll be charged $${topupAmountUsd} on PayPal (≈৳${topupAmount} at today's rate).`
              : `You'll be charged ৳${topupAmount} on bKash.`}
          </p>
        )}
        <Button size="sm" onClick={topUpWallet} disabled={topupBusy || !topupValid}>
          {topupBusy
            ? "Redirecting…"
            : `Top up with ${topupProvider === "paypal" ? "PayPal" : "bKash"}`}
        </Button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
