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
  const kind = url.searchParams.get("kind"); // "subscription" | "wallet_topup" | null (= order)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const supabase = createServiceClient();

  if (kind === "subscription") {
    return handleSubscriptionCallback(request, supabase, paymentID, status, siteUrl);
  }
  if (kind === "wallet_topup") {
    return handleWalletTopupCallback(request, supabase, paymentID, status, siteUrl);
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

    // SECURITY: derive plan/kind from the subscription row we wrote at
    // creation time — never trust the `plan`/`subscription_kind` query
    // params, which are client-controlled on this redirect URL and could
    // otherwise be used to get upgraded to a pricier plan for a cheap
    // payment (e.g. pay for "starter", replay the callback with
    // plan=pro).
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("user_id, type")
      .eq("id", subscriptionId)
      .single();

    if (subscription) {
      if (subscription.type.startsWith("buyer_")) {
        const plan = subscription.type.slice("buyer_".length);
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
      } else if (subscription.type === "seller_monthly") {
        await supabase.from("profiles").update({ seller_plan: "monthly" }).eq("id", subscription.user_id);
      }
    }

    return NextResponse.redirect(`${siteUrl}/dashboard/billing?payment=success`);
  } catch {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_txn_id", paymentID);
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?payment=error`);
  }
}

async function handleWalletTopupCallback(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
  paymentID: string | null,
  status: string | null,
  siteUrl: string
) {
  if (!paymentID) {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }

  // SECURITY: never trust user_id/amount from the query string — they are
  // fully client-controlled (this is a plain redirect URL, not a signed
  // webhook). The only trustworthy source is the `payments` row we wrote
  // ourselves at initiation time, looked up by provider_txn_id.
  const { data: paymentRow } = await supabase
    .from("payments")
    .select("status, payer_id, credit_amount_bdt")
    .eq("provider_txn_id", paymentID)
    .eq("provider", "bkash")
    .single();

  if (!paymentRow || !paymentRow.payer_id || !paymentRow.credit_amount_bdt) {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }

  const userId = paymentRow.payer_id;
  const amount = paymentRow.credit_amount_bdt;

  if (status !== "success") {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_txn_id", paymentID);
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=cancelled`);
  }

  // Idempotency guard: if this payment was already credited (e.g. bKash retries
  // the callback), don't double-credit the wallet.
  if (paymentRow.status === "released") {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
  }

  try {
    const result = await executeBkashPayment(paymentID);

    // Flip payments.status to "released" first, using the fact that this
    // column started as something other than "released" as a one-time gate:
    // if two callbacks race (bKash is known to retry), only the first
    // update actually changes a row — the second gets rowCount 0 and skips
    // crediting the wallet again.
    const { data: claimed } = await supabase
      .from("payments")
      .update({ status: "released", raw_response: result as unknown as Record<string, unknown> })
      .eq("provider_txn_id", paymentID)
      .neq("status", "released")
      .select("provider_txn_id");

    if (!claimed || claimed.length === 0) {
      // Already released by a concurrent/earlier callback.
      return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
    }

    // Atomic credit: a single UPDATE ... SET balance = balance + amount,
    // so a concurrent balance change elsewhere can't be lost (see
    // adjust_wallet_balance in sql/001_atomic_wallet_adjust.sql).
    const { error: creditError } = await supabase.rpc("adjust_wallet_balance", {
      p_user_id: userId,
      p_delta: amount,
      p_type: "topup",
      p_notes: "Wallet top-up via bKash",
      p_provider: "bkash",
      p_provider_txn_id: paymentID,
    });

    if (creditError) throw creditError;

    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
  } catch {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_txn_id", paymentID);
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }
}
