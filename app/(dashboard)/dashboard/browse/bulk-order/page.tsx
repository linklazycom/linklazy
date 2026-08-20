"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";
import { PaymentProtectionBadge } from "@/components/trust/payment-protection-badge";
import { Money } from "@/components/currency/money";

interface SiteRow {
  id: string;
  domain: string;
  niche: string;
  price_amount: number | null;
}

interface CreatedResult {
  created: { id: string; domain: string }[];
  skipped: { domain: string; reason: string }[];
  newBalance?: number;
}

type PaymentMethod = "wallet" | "later";

export default function BulkOrderPage() {
  const searchParams = useSearchParams();
  const ids = (searchParams.get("ids") ?? "").split(",").filter(Boolean);

  const [sites, setSites] = useState<SiteRow[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wallet");
  const [result, setResult] = useState<CreatedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!ids.length) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const [{ data: siteRows }, { data: userRes }] = await Promise.all([
        supabase.from("sites").select("id, domain, niche, price_amount").in("id", ids),
        supabase.auth.getUser(),
      ]);
      setSites((siteRows as SiteRow[]) ?? []);

      if (userRes?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("id", userRes.user.id)
          .single();
        setWalletBalance(profile?.wallet_balance ?? 0);
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = sites.reduce((sum, s) => sum + (s.price_amount ?? 0), 0);
  const walletCoversTotal = walletBalance != null && walletBalance >= total;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      site_ids: ids,
      target_url: form.get("target_url"),
      anchor_text: form.get("anchor_text"),
      notes: form.get("notes") || undefined,
    };

    const endpoint = paymentMethod === "wallet" ? "/api/orders/bulk/pay-wallet" : "/api/orders/bulk";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      const errBody = await res.json();
      setError(typeof errBody.error === "string" ? errBody.error : "Could not place bulk order.");
      return;
    }

    setResult(await res.json());
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  if (result) {
    return (
      <div className="max-w-xl">
        <h1 className="mb-6 font-display text-2xl font-medium">Bulk order placed</h1>
        {result.created.length > 0 && (
          <div className="mb-4 rounded-chip border border-signal/40 bg-signal-soft p-4">
            <p className="mb-2 text-sm font-medium">
              {result.created.length} order{result.created.length > 1 ? "s" : ""} created
              {paymentMethod === "wallet" ? " and paid from your wallet" : ""}
            </p>
            <div className="space-y-1">
              {result.created.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/orders/${c.id}`}
                  className="block text-sm text-brand-blue underline"
                >
                  {c.domain} →
                </Link>
              ))}
            </div>
          </div>
        )}
        {result.skipped.length > 0 && (
          <div className="mb-4 rounded-chip border border-amber/40 bg-amber-soft p-4">
            <p className="mb-2 text-sm font-medium">Skipped</p>
            {result.skipped.map((s, i) => (
              <p key={i} className="text-sm text-muted">
                {s.domain} — {s.reason}
              </p>
            ))}
          </div>
        )}
        {result.newBalance != null && (
          <p className="mb-4 text-sm text-muted">
            New wallet balance: <Money amount={result.newBalance} />
          </p>
        )}
        <Link href="/dashboard/orders">
          <Button size="sm">View all orders</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-2 font-display text-2xl font-medium">Bulk order review</h1>
      <p className="mb-6 text-sm text-muted">
        Same target URL and anchor text will be used for every site below. Bulk orders are
        paid placements only.
      </p>

      <div className="mb-6 space-y-2">
        {sites.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-chip border border-line bg-white p-3 text-sm"
          >
            <div>
              <span className="font-mono font-medium">{s.domain}</span>
              <span className="ml-2 text-muted">{s.niche}</span>
            </div>
            {s.price_amount != null && <MetricChip label="Price" value={s.price_amount} tone="price" />}
          </div>
        ))}
        {!sites.length && (
          <p className="text-sm text-muted">
            No valid sites selected.{" "}
            <Link href="/dashboard/browse" className="underline">
              Go back to browse
            </Link>
            .
          </p>
        )}
      </div>

      {sites.length > 0 && (
        <>
          <p className="mb-4 text-sm font-medium">
            Estimated total: <Money amount={total} />
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-chip border border-line bg-white p-5">
            <div>
              <label htmlFor="target_url" className="mb-1 block text-sm text-muted">
                Target URL
              </label>
              <input
                id="target_url"
                name="target_url"
                type="url"
                required
                placeholder="https://yoursite.com/page"
                className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
              />
            </div>
            <div>
              <label htmlFor="anchor_text" className="mb-1 block text-sm text-muted">
                Anchor text
              </label>
              <input
                id="anchor_text"
                name="anchor_text"
                required
                maxLength={200}
                className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
              />
            </div>
            <div>
              <label htmlFor="notes" className="mb-1 block text-sm text-muted">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                maxLength={1000}
                rows={3}
                className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
              />
            </div>

            <div>
              <p className="mb-2 text-sm text-muted">Payment method</p>
              <div className="space-y-2">
                <label className="flex items-center justify-between rounded-chip border border-line p-3 text-sm has-[:checked]:border-signal">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="payment_method_ui"
                      checked={paymentMethod === "wallet"}
                      onChange={() => setPaymentMethod("wallet")}
                    />
                    Pay with wallet balance
                  </span>
                  {walletBalance != null && (
                    <span className={walletCoversTotal ? "text-muted" : "text-red-600"}>
                      Balance: <Money amount={walletBalance} />
                    </span>
                  )}
                </label>
                <label className="flex items-center gap-2 rounded-chip border border-line p-3 text-sm has-[:checked]:border-signal">
                  <input
                    type="radio"
                    name="payment_method_ui"
                    checked={paymentMethod === "later"}
                    onChange={() => setPaymentMethod("later")}
                  />
                  Create orders now, pay each with bKash / PayPal
                </label>
              </div>
              {paymentMethod === "wallet" && walletBalance != null && !walletCoversTotal && (
                <p className="mt-2 text-sm text-red-600">
                  Wallet balance is lower than the estimated total — orders that don&apos;t fit
                  will be skipped, or{" "}
                  <Link href="/dashboard/billing" className="underline">
                    top up first
                  </Link>
                  .
                </p>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Placing orders…" : `Place ${sites.length} order${sites.length > 1 ? "s" : ""}`}
            </Button>
            <div>
              <PaymentProtectionBadge />
            </div>
          </form>
        </>
      )}
    </div>
  );
}
