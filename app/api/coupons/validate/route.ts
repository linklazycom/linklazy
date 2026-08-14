import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();
  const amount = Number(searchParams.get("amount") ?? 0);

  if (!code) return NextResponse.json({ valid: false, error: "Missing code" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: coupon } = await supabase
    .from("coupons")
    .select("id, code, discount_type, discount_value, max_redemptions, redemption_count, active, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (!coupon || !coupon.active) {
    return NextResponse.json({ valid: false, error: "Invalid or inactive coupon code." });
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: "This coupon has expired." });
  }

  if (coupon.max_redemptions !== null && coupon.redemption_count >= coupon.max_redemptions) {
    return NextResponse.json({ valid: false, error: "This coupon has reached its usage limit." });
  }

  const discount =
    coupon.discount_type === "percent"
      ? Math.round(amount * (coupon.discount_value / 100))
      : Math.min(amount, Math.round(coupon.discount_value));

  return NextResponse.json({
    valid: true,
    couponId: coupon.id,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    discountAmount: discount,
    finalAmount: Math.max(0, amount - discount),
  });
}
