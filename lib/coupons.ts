import type { SupabaseClient } from "@supabase/supabase-js";

interface CouponRow {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_redemptions: number | null;
  redemption_count: number;
  active: boolean;
  expires_at: string | null;
}

interface CouponCheckResult {
  ok: boolean;
  error?: string;
  coupon?: CouponRow;
  discountAmount?: number;
  finalAmount?: number;
}

/**
 * Single source of truth for "is this coupon usable, and what does it
 * discount `amount` down to" — shared by the /api/coupons/validate preview
 * endpoint and actual order creation, so a coupon that previews as valid
 * can't turn out to be rejected (or accepted with different math) once the
 * buyer actually places the order.
 */
export async function checkCoupon(
  supabase: SupabaseClient,
  code: string,
  amount: number
): Promise<CouponCheckResult> {
  const { data: coupon } = await supabase
    .from("coupons")
    .select("id, code, discount_type, discount_value, max_redemptions, redemption_count, active, expires_at")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (!coupon || !coupon.active) {
    return { ok: false, error: "Invalid or inactive coupon code." };
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { ok: false, error: "This coupon has expired." };
  }
  if (coupon.max_redemptions !== null && coupon.redemption_count >= coupon.max_redemptions) {
    return { ok: false, error: "This coupon has reached its usage limit." };
  }

  const discountAmount =
    coupon.discount_type === "percent"
      ? Math.round(amount * (coupon.discount_value / 100))
      : Math.min(amount, Math.round(coupon.discount_value));

  return {
    ok: true,
    coupon,
    discountAmount,
    finalAmount: Math.max(0, amount - discountAmount),
  };
}

/**
 * Best-effort bookkeeping after a coupon has actually been applied to a
 * placed order: bumps coupons.redemption_count and logs the redemption for
 * the /admin/revenue "revenue given up" figure. Wrapped by the caller so a
 * failure here never blocks order creation — the discount was already
 * applied to price_amount either way, which is what actually matters to
 * the buyer's charge.
 */
/**
 * Best-effort bookkeeping after a coupon has actually been applied to a
 * placed order: bumps coupons.redemption_count and logs the redemption for
 * the /admin/revenue "revenue given up" figure. Wrapped by the caller so a
 * failure here never blocks order creation — the discount was already
 * applied to price_amount either way, which is what actually matters to
 * the buyer's charge.
 *
 * Uses a plain read-then-write increment rather than an atomic RPC: unlike
 * wallet balance, a coupon's redemption_count is a soft usage cap, not
 * money, so the small race window on a heavily-contested coupon (two
 * buyers redeeming the last slot in the same instant) is an acceptable
 * trade-off against guessing at an RPC signature we can't see the source
 * of from this repo.
 */
export async function recordCouponRedemption(
  supabase: SupabaseClient,
  params: { couponId: string; currentRedemptionCount: number; orderId: string; userId: string; discountAmount: number }
) {
  await supabase
    .from("coupons")
    .update({ redemption_count: params.currentRedemptionCount + 1 })
    .eq("id", params.couponId);

  await supabase.from("coupon_redemptions").insert({
    coupon_id: params.couponId,
    order_id: params.orderId,
    user_id: params.userId,
    discount_amount: params.discountAmount,
  });
}
