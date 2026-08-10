"use client";

import { useEffect, useState, use as usePromise } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";

interface DisputeDetail {
  id: string;
  reason: string;
  status: string;
  raised_by: string;
  resolution_notes: string | null;
}

interface OrderInfo {
  id: string;
  order_type: string;
  status: string;
  price_amount: number | null;
  target_url: string;
  anchor_text: string;
  buyer_id: string;
  seller_id: string;
  proof_url: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export default function AdminDisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const supabase = createClient();
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data: d } = await supabase
      .from("disputes")
      .select("id, reason, status, raised_by, resolution_notes, order_id")
      .eq("id", id)
      .single();
    setDispute(d as DisputeDetail);

    if (d?.order_id) {
      const { data: o } = await supabase.from("orders").select("*").eq("id", d.order_id).single();
      setOrder(o as OrderInfo);

      const { data: m } = await supabase
        .from("messages")
        .select("id, sender_id, body, created_at")
        .eq("order_id", d.order_id)
        .order("created_at", { ascending: true });
      setMessages((m as Message[]) ?? []);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function resolve(resolution: "resolved_buyer" | "resolved_seller") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/disputes/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution, notes: notes || undefined }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not resolve dispute.");
      setBusy(false);
      return;
    }
    setBusy(false);
    load();
  }

  if (!dispute) return <p className="text-muted">Loading…</p>;

  const isResolved = dispute.status.startsWith("resolved");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-medium">Dispute</h1>
      <div className="mb-6 flex gap-2">
        <MetricChip label="Status" value={dispute.status} tone={isResolved ? "verified" : "price"} />
        {order?.order_type && <MetricChip label="Order type" value={order.order_type} />}
        {order?.price_amount != null && <MetricChip label="Price" value={order.price_amount} tone="price" />}
      </div>

      <div className="mb-6 rounded-chip border border-line bg-white p-4 text-sm">
        <p className="mb-1 font-medium">Reported issue</p>
        <p className="text-ink">{dispute.reason}</p>
      </div>

      {order && (
        <div className="mb-6 rounded-chip border border-line bg-white p-4 text-sm">
          <p className="mb-1 font-medium">Order details</p>
          <p>
            <span className="text-muted">Target: </span>
            <a href={order.target_url} target="_blank" rel="noreferrer" className="underline">
              {order.target_url}
            </a>{" "}
            ({order.anchor_text})
          </p>
          {order.proof_url && (
            <p className="mt-1">
              <span className="text-muted">Proof submitted: </span>
              <a href={order.proof_url} target="_blank" rel="noreferrer" className="underline">
                {order.proof_url}
              </a>
            </p>
          )}
        </div>
      )}

      <div className="mb-6 rounded-chip border border-line bg-white p-4">
        <p className="mb-3 text-sm font-medium">Message history</p>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {messages.map((m) => (
            <div key={m.id} className="rounded-chip bg-paper px-3 py-2 text-sm">
              <span className="mr-2 text-xs text-muted">
                {m.sender_id === order?.buyer_id ? "Buyer" : "Seller"}:
              </span>
              {m.body}
            </div>
          ))}
          {!messages.length && <p className="text-sm text-muted">No messages exchanged.</p>}
        </div>
      </div>

      {!isResolved ? (
        <div className="rounded-chip border border-line bg-white p-5">
          <p className="mb-3 text-sm font-medium">Resolve this dispute</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Internal resolution notes (optional)"
            className="mb-3 w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-brand-violet"
          />
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={() => resolve("resolved_buyer")} disabled={busy} variant="secondary">
              Favor buyer (refund)
            </Button>
            <Button onClick={() => resolve("resolved_seller")} disabled={busy}>
              Favor seller (release payment)
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-chip border border-signal/30 bg-signal-soft p-4 text-sm">
          Resolved in favor of the {dispute.status === "resolved_buyer" ? "buyer" : "seller"}.
          {dispute.resolution_notes && (
            <p className="mt-2 text-muted">Notes: {dispute.resolution_notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
