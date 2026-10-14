import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkCoupon } from "@/lib/coupons";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  // Anyone can call this, so cap guessing of coupon codes.
  const { allowed } = await checkRateLimit("coupon_validate", getRequestIp(request), { max: 30, windowMinutes: 10 });
  if (!allowed) return NextResponse.json({ valid: false, error: "Too many attempts. Please wait a few minutes." }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();
  const rawAmount = Number(searchParams.get("amount") ?? 0);
  const amount = Number.isFinite(rawAmount) && rawAmount >= 0 ? rawAmount : 0;

  if (!code) return NextResponse.json({ valid: false, error: "Missing code" }, { status: 400 });

  const supabase = createServiceClient();
  const result = await checkCoupon(supabase, code, amount);

  if (!result.ok || !result.coupon) {
    return NextResponse.json({ valid: false, error: result.error });
  }

  return NextResponse.json({
    valid: true,
    couponId: result.coupon.id,
    discountType: result.coupon.discount_type,
    discountValue: result.coupon.discount_value,
    discountAmount: result.discountAmount,
    finalAmount: result.finalAmount,
  });
}
