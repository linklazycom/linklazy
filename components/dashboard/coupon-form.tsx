"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function CouponForm() {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);

    // RLS ("admins can manage coupons") enforces this insert only
    // succeeds for an admin session — no separate API route needed.
    // applies_to is always "order": subscription plans were removed
    // product-wide, so orders are the only thing a coupon can discount.
    const { error } = await supabase.from("coupons").insert({
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: Number(discountValue),
      applies_to: "order",
      max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });

    if (error) {
      setError(error.message);
      setSending(false);
      return;
    }

    setCode("");
    setDiscountValue("");
    setMaxRedemptions("");
    setExpiresAt("");
    setSending(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="code" className="mb-1 block text-sm text-muted">
          Code
        </label>
        <input
          id="code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="WELCOME20"
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>
      <div>
        <label htmlFor="discount_type" className="mb-1 block text-sm text-muted">
          Discount type
        </label>
        <select
          id="discount_type"
          value={discountType}
          onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        >
          <option value="percent">Percent off</option>
          <option value="fixed">Fixed amount off (৳)</option>
        </select>
      </div>
      <div>
        <label htmlFor="discount_value" className="mb-1 block text-sm text-muted">
          Discount value
        </label>
        <input
          id="discount_value"
          type="number"
          required
          min={1}
          value={discountValue}
          onChange={(e) => setDiscountValue(e.target.value)}
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>
      <div>
        <label htmlFor="max_redemptions" className="mb-1 block text-sm text-muted">
          Max redemptions (optional)
        </label>
        <input
          id="max_redemptions"
          type="number"
          min={1}
          value={maxRedemptions}
          onChange={(e) => setMaxRedemptions(e.target.value)}
          placeholder="Unlimited"
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>
      <div>
        <label htmlFor="expires_at" className="mb-1 block text-sm text-muted">
          Expires (optional)
        </label>
        <input
          id="expires_at"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={sending}>
          {sending ? "Creating…" : "Create coupon"}
        </Button>
      </div>
    </form>
  );
}
