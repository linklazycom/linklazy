import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBkashPayment } from "@/lib/bkash/client";
import { z } from "zod";

const subscribeSchema = z.object({
  kind: z.enum(["buyer", "seller"]),
  plan: z.enum(["starter", "growth", "pro", "monthly"]),
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
  const { kind, plan } = parsed.data;

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

  // Free plans (amount 0) skip the payment gateway entirely.
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
