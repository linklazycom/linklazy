"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PaymentProtectionBadge } from "@/components/trust/payment-protection-badge";
import { Field } from "@/components/ui/field";

export function RequestLinkForm({
  siteId,
  acceptsExchange,
  acceptsPaid,
  defaultTargetUrl,
  defaultAnchorText,
}: {
  siteId: string;
  acceptsExchange: boolean;
  acceptsPaid: boolean;
  defaultTargetUrl?: string;
  defaultAnchorText?: string;
}) {
  const router = useRouter();
  const [orderType, setOrderType] = useState<"exchange" | "paid">(
    acceptsPaid ? "paid" : "exchange"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      site_id: siteId,
      order_type: orderType,
      buyer_site_id: orderType === "exchange" ? form.get("buyer_site_id") || undefined : undefined,
      target_url: form.get("target_url"),
      anchor_text: form.get("anchor_text"),
      notes: form.get("notes") || undefined,
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
      <h2 className="text-sm font-medium">Request this link</h2>

      {acceptsExchange && acceptsPaid && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOrderType("paid")}
            className={`rounded-chip border px-3 py-2 text-sm ${
              orderType === "paid" ? "border-ink bg-ink text-paper" : "border-line"
            }`}
          >
            Pay for placement
          </button>
          <button
            type="button"
            onClick={() => setOrderType("exchange")}
            className={`rounded-chip border px-3 py-2 text-sm ${
              orderType === "exchange" ? "border-ink bg-ink text-paper" : "border-line"
            }`}
          >
            Propose exchange
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
        {submitting ? "Sending…" : orderType === "paid" ? "Continue to payment" : "Send exchange request"}
      </Button>
      {orderType === "paid" && (
        <div>
          <PaymentProtectionBadge />
        </div>
      )}
    </form>
  );
}
