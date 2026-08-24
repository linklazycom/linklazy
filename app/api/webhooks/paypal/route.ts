import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { capturePaypalOrder } from "@/lib/paypal/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paypalOrderId = url.searchParams.get("token"); // PayPal appends this to the return_url
  const kind = url.searchParams.get("kind"); // "wallet_topup" | null (= order)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const supabase = createServiceClient();

  if (kind === "wallet_topup") {
    return handleWalletTopupCallback(request, supabase, paypalOrderId, siteUrl);
  }
  return handleOrderCallback(supabase, paypalOrderId, url.searchParams.get("order_id"), siteUrl);
}

async function handleOrderCallback(
  supabase: ReturnType<typeof createServiceClient>,
  paypalOrderId: string | null,
  orderId: string | null,
  siteUrl: string
) {
  if (!orderId || !paypalOrderId) {
    return NextResponse.redirect(`${siteUrl}/dashboard/orders?payment=error`);
  }

  try {
    const captured = await capturePaypalOrder(paypalOrderId);
    if (captured.status !== "COMPLETED") throw new Error("Payment was not completed");

    await supabase
      .from("payments")
      .update({ status: "held_escrow" })
      .eq("provider_txn_id", paypalOrderId)
      .eq("order_id", orderId);

    await supabase
      .from("orders")
      .update({ status: "pending_seller_acceptance" })
      .eq("id", orderId)
      .eq("status", "pending_payment");

    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=success`);
  } catch {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_txn_id", paypalOrderId);
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=error`);
  }
}

async function handleWalletTopupCallback(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
  paypalOrderId: string | null,
  siteUrl: string
) {
  if (!paypalOrderId) {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }

  // SECURITY: never trust user_id/amount from the query string — they are
  // fully client-controlled. Look up the trustworthy amount/payer we wrote
  // ourselves at initiation time instead.
  const { data: paymentRow } = await supabase
    .from("payments")
    .select("status, payer_id, credit_amount_bdt")
    .eq("provider_txn_id", paypalOrderId)
    .eq("provider", "paypal")
    .single();

  if (!paymentRow || !paymentRow.payer_id || !paymentRow.credit_amount_bdt) {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }

  const userId = paymentRow.payer_id;
  const amount = paymentRow.credit_amount_bdt;

  // Idempotency guard: if this payment was already credited, don't double-credit the wallet.
  if (paymentRow.status === "released") {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
  }

  try {
    const captured = await capturePaypalOrder(paypalOrderId);
    if (captured.status !== "COMPLETED") throw new Error("Payment was not completed");

    // Flip payments.status to "released" first, using the fact that this
    // column started as something other than "released" as a one-time gate:
    // if two callbacks race, only the first update actually changes a row.
    // The second gets rowCount 0 and skips crediting the wallet again.
    const { data: claimed } = await supabase
      .from("payments")
      .update({ status: "released" })
      .eq("provider_txn_id", paypalOrderId)
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
      p_notes: "Wallet top-up via PayPal",
      p_provider: "paypal",
      p_provider_txn_id: paypalOrderId,
    });

    if (creditError) throw creditError;

    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
  } catch {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_txn_id", paypalOrderId);
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }
}
