"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PaymentProtectionBadge } from "@/components/trust/payment-protection-badge";
import { Field } from "@/components/ui/field";
import { Money } from "@/components/currency/money";
import { siteCtaLabel } from "@/lib/site-cta";

type PaymentMethod = "wallet" | "bkash" | "paypal";

export function RequestLinkForm({
  siteId,
  acceptsExchange,
  acceptsPaid,
  priceAmount,
  defaultTargetUrl,
  defaultAnchorText,
}: {
  siteId: string;
  acceptsExchange: boolean;
  acceptsPaid: boolean;
  /** Needed to know if the wallet balance actually covers this order. */
  priceAmount?: number | null;
  defaultTargetUrl?: string;
  defaultAnchorText?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [orderType, setOrderType] = useState<"exchange" | "paid">(
    acceptsPaid ? "paid" : "exchange"
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wallet");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponResult, setCouponResult] = useState<{ valid: boolean; error?: string; discountAmount?: number; finalAmount?: number } | null>(null);

  useEffect(() => {
    async function loadWallet() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("wallet_balance").eq("id", user.id).single();
      setWalletBalance(data?.wallet_balance ?? 0);
    }
    loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canPayFromWallet = priceAmount != null && walletBalance != null && walletBalance >= priceAmount;

  // If the wallet can't cover it once we know the balance, default to
  // bKash instead of leaving "Wallet" selected with a disabled button.
  useEffect(() => {
    if (orderType === "paid" && walletBalance != null && priceAmount != null && walletBalance < priceAmount) {
      setPaymentMethod("bkash");
    }
  }, [walletBalance, priceAmount, orderType]);

  async function handleApplyCoupon() {
    if (!couponCode.trim() || priceAmount == null) return;
    setCouponChecking(true);
    setCouponResult(null);
    try {
      const res = await fetch(
        `/api/coupons/validate?code=${encodeURIComponent(couponCode.trim())}&amount=${priceAmount}`
      );
      const body = await res.json();
      setCouponResult(body);
    } finally {
      setCouponChecking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const targetUrl = form.get("target_url");
    const anchorText = form.get("anchor_text");
    const notes = form.get("notes") || undefined;

    // Paid + wallet checks out immediately (no redirect) — same atomic
    // charge-and-create-order RPC the bulk wallet checkout uses.
    if (orderType === "paid" && paymentMethod === "wallet") {
      const res = await fetch("/api/orders/pay-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId, target_url: targetUrl, anchor_text: anchorText, notes }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not place this order.");
        setSubmitting(false);
        return;
      }
      router.push(`/dashboard/orders/${body.id}`);
      return;
    }

    // Exchange, or paid + bKash/PayPal: create the order first, then land
    // on the order page — for paid orders that page already shows the
    // bKash/PayPal checkout buttons for a pending_payment order.
    const payload = {
      site_id: siteId,
      order_type: orderType,
      buyer_site_id: orderType === "exchange" ? form.get("buyer_site_id") || undefined : undefined,
      target_url: targetUrl,
      anchor_text: anchorText,
      notes,
      coupon_code: paymentMethod !== "wallet" && couponResult?.valid ? couponCode.trim() : undefined,
    };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Could not create order.");
      setSubmitting(false);
      return;
    }

    const { id } = await res.json();
    router.push(`/dashboard/orders/${id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-chip border border-line bg-white p-5">
      <h2 className="text-sm font-medium">{siteCtaLabel(acceptsPaid, acceptsExchange)}</h2>

      {acceptsExchange && acceptsPaid && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOrderType("paid")}
            className={`rounded-chip border px-3 py-2 text-sm ${
              orderType === "paid" ? "border-ink bg-ink text-paper" : "border-line"
            }`}
          >
            Order (pay for placement)
          </button>
          <button
            type="button"
            onClick={() => setOrderType("exchange")}
            className={`rounded-chip border px-3 py-2 text-sm ${
              orderType === "exchange" ? "border-ink bg-ink text-paper" : "border-line"
            }`}
          >
            Request exchange (no payment)
          </button>
        </div>
      )}

      {orderType === "exchange" && (
        <Field
          id="buyer_site_id"
          name="buyer_site_id"
          label="Your site ID (from My Sites)"
          placeholder="Paste your approved site's ID"
          required
        />
      )}

      {orderType === "paid" && priceAmount != null && (
        <div>
          <label className="mb-2 block text-sm text-muted">Payment method</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("wallet")}
              disabled={!canPayFromWallet}
              className={`rounded-chip border p-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                paymentMethod === "wallet" ? "border-brand-violet bg-brand-soft" : "border-line"
              }`}
            >
              <span className="block font-medium">Wallet</span>
              <span className="mt-0.5 block text-xs text-muted">
                {walletBalance == null ? "…" : <Money amount={walletBalance} />} balance
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("bkash")}
              className={`rounded-chip border p-3 text-left text-sm ${
                paymentMethod === "bkash" ? "border-brand-violet bg-brand-soft" : "border-line"
              }`}
            >
              <span className="block font-medium">bKash</span>
              <span className="mt-0.5 block text-xs text-muted">BDT</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("paypal")}
              className={`rounded-chip border p-3 text-left text-sm ${
                paymentMethod === "paypal" ? "border-brand-violet bg-brand-soft" : "border-line"
              }`}
            >
              <span className="block font-medium">PayPal</span>
              <span className="mt-0.5 block text-xs text-muted">USD</span>
            </button>
          </div>
          <p className="mt-2 text-sm">
            Total: <Money amount={priceAmount} />
          </p>
          {!canPayFromWallet && walletBalance != null && (
            <p className="mt-1 text-xs text-muted">
              Wallet balance <Money amount={walletBalance} /> isn&apos;t enough to cover this order —
              pay with bKash or PayPal instead, or{" "}
              <a href="/dashboard/billing" className="underline">
                top up your wallet
              </a>
              .
            </p>
          )}
          {paymentMethod !== "wallet" && (
            <div className="mt-3">
              <label htmlFor="coupon_code" className="mb-1 block text-sm text-muted">
                Coupon code (optional)
              </label>
              <div className="flex gap-2">
                <input
                  id="coupon_code"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    setCouponResult(null);
                  }}
                  placeholder="LINKLAZY10"
                  className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleApplyCoupon}
                  disabled={couponChecking || !couponCode.trim()}
                >
                  {couponChecking ? "Checking…" : "Apply"}
                </Button>
              </div>
              {couponResult && !couponResult.valid && (
                <p className="mt-1 text-xs text-red-600">{couponResult.error}</p>
              )}
              {couponResult?.valid && (
                <p className="mt-1 text-xs text-signal">
                  Coupon applied — new total <Money amount={couponResult.finalAmount ?? priceAmount} />
                </p>
              )}
              <p className="mt-1 text-xs text-muted">
                Coupons apply to bKash and PayPal checkout only, not wallet payment.
              </p>
            </div>
          )}
        </div>
      )}

      <Field id="target_url" name="target_url" label="Page to link to" placeholder="https://yoursite.com/page" required defaultValue={defaultTargetUrl} />
      <Field id="anchor_text" name="anchor_text" label="Anchor text" placeholder="best gardening tools" required defaultValue={defaultAnchorText} />
      <div>
        <label htmlFor="notes" className="mb-1 block text-sm text-muted">
          Notes for the seller (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting
          ? "Sending…"
          : orderType === "paid"
            ? paymentMethod === "wallet"
              ? "Pay from wallet & place order"
              : `Continue to ${paymentMethod === "bkash" ? "bKash" : "PayPal"} checkout`
            : "Send exchange request"}
      </Button>
      {orderType === "paid" && (
        <div>
          <PaymentProtectionBadge />
        </div>
      )}
    </form>
  );
}
