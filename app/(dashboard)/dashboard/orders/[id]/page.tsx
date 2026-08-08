"use client";

import { useEffect, useState, use as usePromise } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MetricChip } from "@/components/ui/metric-chip";
import { ChatWindow } from "@/components/orders/chat-window";

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
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user!.id);

    const { data } = await supabase.from("orders").select("*").eq("id", id).single();
    setOrder(data as OrderDetail);
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

      {isSeller && ["awaiting_seller_site", "in_progress", "pending_payment"].includes(order.status) && (
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
        <p className="mb-6 text-sm text-signal">
          Order accepted{isBuyer && order.price_amount ? " — payment released to the seller." : "."}{" "}
          You can now leave a review.
        </p>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <h2 className="mb-2 text-sm font-medium">Messages</h2>
      <ChatWindow orderId={id} userId={userId} />
    </div>
  );
}
