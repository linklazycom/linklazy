import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkCoupon } from "@/lib/coupons";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();
  const amount = Number(searchParams.get("amount") ?? 0);

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
