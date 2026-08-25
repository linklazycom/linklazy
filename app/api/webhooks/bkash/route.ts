import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { executeBkashPayment } from "@/lib/bkash/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentID = url.searchParams.get("paymentID");
  const status = url.searchParams.get("status"); // success | failure | cancel
  const kind = url.searchParams.get("kind"); // "wallet_topup" | null (= order)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const supabase = createServiceClient();

  // NOTE: subscription plans were removed — LinkLazy is free to join, no
  // monthly fee. There is no "kind=subscription" branch anymore; any old
  // bookmarked/cached callback URL with that kind falls through to the
  // order handler below and will simply fail to find a matching order,
  // which is the safe outcome.
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
      .update({ status: "pending_seller_acceptance" })
      .eq("id", orderId)
      .eq("status", "pending_payment");

    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=success`);
  } catch {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_txn_id", paymentID);
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=error`);
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

    // Re-check status right before crediting to close the race window if
    // two callbacks arrive concurrently.
    const { data: recheck } = await supabase
      .from("payments")
      .select("status")
      .eq("provider_txn_id", paymentID)
      .single();
    if (recheck?.status === "released") {
      return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
    }

    await supabase
      .from("payments")
      .update({ status: "released", raw_response: result as unknown as Record<string, unknown> })
      .eq("provider_txn_id", paymentID);

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", userId)
      .single();

    const newBalance = (profile?.wallet_balance ?? 0) + amount;

    await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("id", userId);

    await supabase.from("wallet_ledger").insert({
      user_id: userId,
      type: "topup",
      amount,
      balance_after: newBalance,
      provider: "bkash",
      provider_txn_id: paymentID,
      notes: "Wallet top-up via bKash",
    });

    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
  } catch {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_txn_id", paymentID);
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }
}
