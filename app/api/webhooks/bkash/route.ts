import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { executeBkashPayment } from "@/lib/bkash/client";

const BUYER_PLAN_VIEWS: Record<string, number> = {
  starter: 10,
  growth: 20,
  pro: 50,
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentID = url.searchParams.get("paymentID");
  const status = url.searchParams.get("status"); // success | failure | cancel
  const kind = url.searchParams.get("kind"); // "subscription" | null (= order)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const supabase = createServiceClient();

  if (kind === "subscription") {
    return handleSubscriptionCallback(request, supabase, paymentID, status, siteUrl);
  }
  return handleOrderCallback(supabase, paymentID, url.searchParams.get("order_id"), status, siteUrl);
}

async function handleOrderCallback(
  supabase: ReturnType<typeof createServiceClient>,
  paymentID: string | null,
  orderId: string | null,
  status: string | null,
  siteUrl: string
) {
  if (!paymentID || !orderId) {
    return NextResponse.redirect(`${siteUrl}/dashboard/orders?payment=error`);
  }

  if (status !== "success") {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_txn_id", paymentID);
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=cancelled`);
  }

  try {
    const result = await executeBkashPayment(paymentID);

    await supabase
      .from("payments")
      .update({ status: "held_escrow", raw_response: result as unknown as Record<string, unknown> })
      .eq("provider_txn_id", paymentID);

    await supabase
      .from("orders")
      .update({ status: "in_progress" })
      .eq("id", orderId)
      .eq("status", "pending_payment");

    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=success`);
  } catch {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_txn_id", paymentID);
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=error`);
  }
}

async function handleSubscriptionCallback(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
  paymentID: string | null,
  status: string | null,
  siteUrl: string
) {
  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get("subscription_id");
  const plan = url.searchParams.get("plan");
  const subscriptionKind = url.searchParams.get("subscription_kind"); // buyer | seller

  if (!paymentID || !subscriptionId) {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?payment=error`);
  }

  if (status !== "success") {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_txn_id", paymentID);
    await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", subscriptionId);
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?payment=cancelled`);
  }

  try {
    const result = await executeBkashPayment(paymentID);

    await supabase
      .from("payments")
      .update({ status: "released", raw_response: result as unknown as Record<string, unknown> })
      .eq("provider_txn_id", paymentID);

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("id", subscriptionId)
      .single();

    if (subscription) {
      if (subscriptionKind === "buyer" && plan) {
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await supabase
          .from("profiles")
          .update({
            buyer_plan: plan,
            buyer_views_quota: BUYER_PLAN_VIEWS[plan] ?? 0,
            buyer_views_used: 0,
            buyer_plan_renews_at: periodEnd.toISOString(),
          })
          .eq("id", subscription.user_id);
      } else if (subscriptionKind === "seller") {
        await supabase.from("profiles").update({ seller_plan: "monthly" }).eq("id", subscription.user_id);
      }
    }

    return NextResponse.redirect(`${siteUrl}/dashboard/billing?payment=success`);
  } catch {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_txn_id", paymentID);
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?payment=error`);
  }
}
