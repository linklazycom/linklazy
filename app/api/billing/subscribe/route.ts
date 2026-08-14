import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createBkashPayment } from "@/lib/bkash/client";
import { z } from "zod";

const subscribeSchema = z.object({
  kind: z.enum(["buyer", "seller"]),
  plan: z.enum(["starter", "growth", "pro", "monthly"]),
  coupon_code: z.string().trim().max(50).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { kind, plan, coupon_code } = parsed.data;

  const settingKey =
    kind === "buyer" ? `buyer_plan_${plan}` : "seller_monthly_price";
  const { data: setting } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", settingKey)
    .single();

  let amount: number;
  let views: number | undefined;
  if (kind === "buyer") {
    const config = setting?.value as { views: number; price_amount: number } | undefined;
    amount = config?.price_amount ?? 0;
    views = config?.views;
  } else {
    amount = Number(setting?.value ?? 0);
  }

  const originalAmount = amount;

  // Optional coupon — validated + redeemed server-side so the discount
  // can't be forged by sending a different amount from the client.
  let appliedCouponId: string | null = null;
  if (coupon_code && amount > 0) {
    const serviceClient = createServiceClient();
    const { data: coupon } = await serviceClient
      .from("coupons")
      .select("id, discount_type, discount_value, max_redemptions, redemption_count, active, expires_at")
      .eq("code", coupon_code.trim().toUpperCase())
      .maybeSingle();

    const isValid =
      coupon &&
      coupon.active &&
      (!coupon.expires_at || new Date(coupon.expires_at) >= new Date()) &&
      (coupon.max_redemptions === null || coupon.redemption_count < coupon.max_redemptions);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid, expired, or fully-used coupon code." }, { status: 400 });
    }

    const discount =
      coupon.discount_type === "percent"
        ? Math.round(amount * (coupon.discount_value / 100))
        : Math.min(amount, Math.round(coupon.discount_value));

    amount = Math.max(0, amount - discount);
    appliedCouponId = coupon.id;
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .insert({
      user_id: user.id,
      type: kind === "buyer" ? `buyer_${plan}` : "seller_monthly",
      status: "active",
      price_amount: amount,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })
    .select("id")
    .single();

  if (subError || !subscription) {
    return NextResponse.json({ error: subError?.message ?? "Could not create subscription" }, { status: 500 });
  }

  // Coupon redemption is recorded regardless of amount, right after the
  // subscription exists to reference in `context`.
  if (appliedCouponId) {
    const serviceClient = createServiceClient();
    await serviceClient.from("coupon_redemptions").insert({
      coupon_id: appliedCouponId,
      user_id: user.id,
      context: `subscription:${subscription.id}`,
      discount_amount: originalAmount - amount,
    });
    await serviceClient.rpc("increment_coupon_redemption_count", { coupon_id_input: appliedCouponId }).catch(() => {
      // Fallback if the RPC helper doesn't exist — best-effort increment.
    });
  }

  // Free plans (amount 0, including a 100%-off coupon) skip the payment gateway entirely.
  if (amount <= 0) {
    if (kind === "buyer") {
      await supabase
        .from("profiles")
        .update({
          buyer_plan: plan,
          buyer_views_quota: views ?? 0,
          buyer_views_used: 0,
          buyer_plan_renews_at: periodEnd.toISOString(),
        })
        .eq("id", user.id);
    } else {
      await supabase.from("profiles").update({ seller_plan: "monthly" }).eq("id", user.id);
    }
    return NextResponse.json({ ok: true, free: true });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    const payment = await createBkashPayment({
      amount,
      orderId: subscription.id,
      callbackURL: `${siteUrl}/api/webhooks/bkash?kind=subscription&subscription_id=${subscription.id}&plan=${plan}&subscription_kind=${kind}`,
    });

    await supabase.from("payments").insert({
      subscription_id: subscription.id,
      payer_id: user.id,
      provider: "bkash",
      provider_txn_id: payment.paymentID,
      amount,
      currency: "BDT",
      status: "initiated",
    });

    return NextResponse.json({ redirectUrl: payment.bkashURL });
  } catch (err) {
    return NextResponse.json(
      { error: `Payment could not be started: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
