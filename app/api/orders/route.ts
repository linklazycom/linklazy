import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createOrderSchema } from "@/lib/validators/order";
import { checkCoupon, recordCouponRedemption } from "@/lib/coupons";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const input = parsed.data;

  const { data: site } = await supabase
    .from("sites")
    .select("id, owner_id, status, price_amount, turnaround_hours, accepts_exchange, accepts_paid")
    .eq("id", input.site_id)
    .single();

  if (!site || site.status !== "approved") {
    return NextResponse.json({ error: "Site not available" }, { status: 404 });
  }
  if (site.owner_id === user.id) {
    return NextResponse.json({ error: "You can't order a link from your own site" }, { status: 400 });
  }
  if (input.order_type === "exchange" && !site.accepts_exchange) {
    return NextResponse.json({ error: "This site doesn't accept exchanges" }, { status: 400 });
  }
  if (input.order_type === "paid" && !site.accepts_paid) {
    return NextResponse.json({ error: "This site doesn't accept paid orders" }, { status: 400 });
  }
  if (input.order_type === "exchange" && !input.buyer_site_id) {
    return NextResponse.json(
      { error: "List your own site to propose an exchange" },
      { status: 400 }
    );
  }

  // Commission is no longer fixed at order time: it's tiered on the
  // seller's cumulative monthly sales and finalized when the order is
  // accepted/released (see lib/commission.ts and app/api/orders/[id]/accept/route.ts).
  // commission_amount / commission_rate stay null until then.

  // Coupon (bKash/PayPal path only — see lib/coupons.ts for why the
  // wallet checkout doesn't support this yet). Re-checks the coupon here
  // rather than trusting a discount the client sends, since the client
  // could otherwise submit any price it wants.
  let finalPrice = input.order_type === "paid" ? site.price_amount : null;
  let appliedCoupon: { id: string; redemption_count: number; discountAmount: number } | null = null;

  if (input.order_type === "paid" && input.coupon_code && finalPrice != null) {
    const service = createServiceClient();
    const couponResult = await checkCoupon(service, input.coupon_code, finalPrice);
    if (!couponResult.ok || !couponResult.coupon) {
      return NextResponse.json({ error: couponResult.error ?? "Invalid coupon." }, { status: 400 });
    }
    finalPrice = couponResult.finalAmount ?? finalPrice;
    appliedCoupon = {
      id: couponResult.coupon.id,
      redemption_count: couponResult.coupon.redemption_count,
      discountAmount: couponResult.discountAmount ?? 0,
    };
  }

  const deadline = new Date(Date.now() + (site.turnaround_hours ?? 48) * 3600 * 1000);

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      buyer_id: user.id,
      seller_id: site.owner_id,
      site_id: site.id,
      slot_id: input.slot_id,
      buyer_site_id: input.order_type === "exchange" ? input.buyer_site_id : null,
      order_type: input.order_type,
      status: input.order_type === "paid" ? "pending_payment" : "pending_seller_acceptance",
      target_url: input.target_url,
      anchor_text: input.anchor_text,
      notes: input.notes,
      price_amount: finalPrice,
      deadline_at: deadline.toISOString(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort — a failure here doesn't undo the order or its already
  // -applied discount, it just means the coupon's usage count / the
  // admin revenue "cost given up" figure might be slightly behind.
  if (appliedCoupon) {
    const service = createServiceClient();
    await recordCouponRedemption(service, {
      couponId: appliedCoupon.id,
      currentRedemptionCount: appliedCoupon.redemption_count,
      orderId: order.id,
      userId: user.id,
      discountAmount: appliedCoupon.discountAmount,
    }).catch(() => {
      // Swallowed intentionally — see comment above.
    });
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/orders");

  return NextResponse.json({ id: order.id });
}
