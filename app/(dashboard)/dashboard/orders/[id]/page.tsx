"use client";

import Link from "next/link";

import { useEffect, useState, use as usePromise } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MetricChip } from "@/components/ui/metric-chip";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { ReviewForm } from "@/components/reviews/review-form";
import { ReviewsList } from "@/components/reviews/reviews-list";
import { useCurrency } from "@/components/currency/currency-provider";

interface OrderDetail {
  id: string;
  buyer_id: string;
  seller_id: string;
  order_type: string;
  status: string;
  target_url: string;
  anchor_text: string;
  notes: string | null;
  price_amount: number | null;
  proof_url: string | null;
  proof_screenshot_url: string | null;
  deadline_at: string | null;
}

interface CounterpartyReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const supabase = createClient();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [counterpartyReviews, setCounterpartyReviews] = useState<CounterpartyReview[]>([]);
  const [paymentProvider, setPaymentProvider] = useState<"bkash" | "paypal">("bkash");
  const { rate } = useCurrency();

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user!.id);

    const { data } = await supabase.from("orders").select("*").eq("id", id).single();
    const orderData = data as OrderDetail;
    setOrder(orderData);

    if (orderData) {
      const counterpartyId = orderData.buyer_id === user!.id ? orderData.seller_id : orderData.buyer_id;
      const { data: reviewData } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at")
        .eq("reviewee_id", counterpartyId)
        .order("created_at", { ascending: false })
        .limit(20);
      setCounterpartyReviews((reviewData as CounterpartyReview[]) ?? []);
    }

    const { data: existingReview } = await supabase
      .from("reviews")
      .select("id")
      .eq("order_id", id)
      .eq("reviewer_id", user!.id)
      .maybeSingle();
    setHasReviewed(Boolean(existingReview));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleDeliver(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/orders/${id}/deliver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proof_url: form.get("proof_url"),
        proof_screenshot_url: form.get("proof_screenshot_url") || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Could not submit proof.");
    }
    setBusy(false);
    load();
  }

  async function handleAccept() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${id}/accept`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not accept.");
    }
    setBusy(false);
    load();
  }

  async function handlePay() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${id}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: paymentProvider }) });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not start payment.");
      setBusy(false);
      return;
    }
    window.location.href = body.redirectUrl;
  }

  async function handleDispute(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/orders/${id}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: form.get("reason") }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Could not open a dispute.");
      setBusy(false);
      return;
    }
    setShowDisputeForm(false);
    setBusy(false);
    load();
  }

  if (!order || !userId) return <p className="text-muted">Loading…</p>;

  const isSeller = order.seller_id === userId;
  const isBuyer = order.buyer_id === userId;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-medium">Order</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        <MetricChip label="Status" value={order.status} tone={order.status === "accepted" ? "verified" : "price"} />
        <MetricChip label="Type" value={order.order_type} />
        {order.price_amount != null && <MetricChip label="Price" value={order.price_amount} tone="price" />}
        <MetricChip label="Anchor" value={order.anchor_text} />
      </div>

      <div className="mb-6">
        <OrderTimeline status={order.status} role={isSeller ? "seller" : "buyer"} />
      </div>

      <div className="mb-6 rounded-chip border border-line bg-white p-4 text-sm">
        <p>
          <span className="text-muted">Target URL: </span>
          <a href={order.target_url} target="_blank" rel="noreferrer" className="underline">
            {order.target_url}
          </a>
        </p>
        {order.notes && <p className="mt-2 text-muted">Notes: {order.notes}</p>}
        {order.deadline_at && (
          <p className="mt-2 text-muted">
            Delivery deadline: {new Date(order.deadline_at).toLocaleString()}
          </p>
        )}
      </div>

      {order.status === "delivered" && (order.proof_url || order.proof_screenshot_url) && (
        <div className="mb-6 rounded-chip border border-line bg-white p-4 text-sm">
          <p className="mb-1 font-medium">Delivery proof</p>
          {order.proof_url && (
            <a href={order.proof_url} target="_blank" rel="noreferrer" className="block underline">
              {order.proof_url}
            </a>
          )}
        </div>
      )}

      {isBuyer && order.status === "pending_payment" && (
        <div className="mb-6 rounded-xl border border-line bg-white p-5">
          <h2 className="font-medium">Choose a payment method</h2>
          <p className="mt-1 text-sm text-muted">bKash charges in BDT; PayPal charges in USD at the platform exchange rate.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setPaymentProvider("bkash")} className={`rounded-chip border p-4 text-left ${paymentProvider === "bkash" ? "border-brand-violet bg-brand-soft" : "border-line"}`}><span className="block font-medium">bKash</span><span className="mt-1 block text-sm text-muted">৳{Number(order.price_amount).toLocaleString()} BDT</span></button>
            <button type="button" onClick={() => setPaymentProvider("paypal")} className={`rounded-chip border p-4 text-left ${paymentProvider === "paypal" ? "border-brand-violet bg-brand-soft" : "border-line"}`}><span className="block font-medium">PayPal</span><span className="mt-1 block text-sm text-muted">${(Number(order.price_amount) / rate).toFixed(2)} USD</span></button>
          </div>
          <Button className="mt-4" onClick={handlePay} disabled={busy}>{busy ? "Redirecting…" : `Pay with ${paymentProvider === "bkash" ? "bKash (BDT)" : "PayPal (USD)"}`}</Button>
        </div>
      )}

      {isSeller && ["awaiting_seller_site", "in_progress"].includes(order.status) && (
        <form onSubmit={handleDeliver} className="mb-6 space-y-4 rounded-chip border border-line bg-white p-5">
          <h2 className="text-sm font-medium">Submit delivery proof</h2>
          <Field id="proof_url" name="proof_url" label="Published page URL" placeholder="https://yoursite.com/post-with-link" required />
          <Field id="proof_screenshot_url" name="proof_screenshot_url" label="Screenshot URL (optional)" />
          <Button type="submit" disabled={busy}>
            {busy ? "Submitting…" : "Mark as delivered"}
          </Button>
        </form>
      )}

      {isBuyer && order.status === "delivered" && (
        <div className="mb-6">
          <Button onClick={handleAccept} disabled={busy}>
            {busy ? "Confirming…" : "Accept — link is live and correct"}
          </Button>
        </div>
      )}

      {order.status === "accepted" && (
        <>
          <p className="mb-4 text-sm text-signal">
            Order accepted{isBuyer && order.price_amount ? " — payment released to the seller." : "."}
          </p>
          {!hasReviewed ? (
            <div className="mb-6">
              <ReviewForm orderId={id} onDone={load} />
            </div>
          ) : (
            <p className="mb-6 text-sm text-muted">You&apos;ve already reviewed this order.</p>
          )}
        </>
      )}

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-medium">
          {isSeller ? "Reviews of this buyer" : "Reviews of this seller"}
        </h2>
        <ReviewsList reviews={counterpartyReviews} />
      </div>

      {order.status === "disputed" && (
        <div className="mb-6 rounded-chip border border-amber/40 bg-amber-soft p-4 text-sm">
          This order is under dispute. An admin will review it and reach a
          decision — you don&apos;t need to do anything else here.
        </div>
      )}

      {!["accepted", "disputed", "cancelled", "refunded"].includes(order.status) && (
        <div className="mb-6">
          {!showDisputeForm ? (
            <button
              type="button"
              onClick={() => setShowDisputeForm(true)}
              className="text-sm text-muted underline"
            >
              Something wrong? Report a problem
            </button>
          ) : (
            <form onSubmit={handleDispute} className="space-y-3 rounded-chip border border-line bg-white p-5">
              <h2 className="text-sm font-medium">Report a problem with this order</h2>
              <textarea
                name="reason"
                required
                minLength={10}
                rows={3}
                placeholder="What went wrong? An admin will review this."
                className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-brand-violet"
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" variant="secondary" disabled={busy}>
                  {busy ? "Submitting…" : "Open a dispute"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowDisputeForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Link
        href={`/dashboard/messages/${id}`}
        className="flex items-center justify-between rounded-chip border border-line bg-white p-4 hover:border-brand-violet"
      >
        <div>
          <p className="text-sm font-medium">Messages</p>
          <p className="text-xs text-muted">Chat with the {isSeller ? "buyer" : "seller"} about this order</p>
        </div>
        <span className="text-sm text-brand-blue underline">Open →</span>
      </Link>
    </div>
  );
}
