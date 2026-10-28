import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { capturePaypalOrder, paypalCapturedUsd } from "@/lib/paypal/client";

type Service = ReturnType<typeof createServiceClient>;

type PaymentRow = {
  id: string;
  status: string;
  amount: number;
  payer_id: string | null;
  credit_amount_bdt: number | null;
  raw_response: Record<string, unknown> | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paypalOrderId = url.searchParams.get("token"); // PayPal appends this to the return_url
  const kind = url.searchParams.get("kind"); // "wallet_topup" | null (= order)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const supabase = createServiceClient();

  if (kind === "wallet_topup") {
    return handleWalletTopupCallback(supabase, paypalOrderId, siteUrl);
  }
  return handleOrderCallback(supabase, paypalOrderId, url.searchParams.get("order_id"), siteUrl);
}

async function loadPayment(
  supabase: Service,
  paypalOrderId: string,
  orderId: string | null
): Promise<PaymentRow | null> {
  let query = supabase
    .from("payments")
    .select("id, status, amount, payer_id, credit_amount_bdt, raw_response")
    .eq("provider", "paypal")
    .eq("provider_txn_id", paypalOrderId);
  // For order payments the payment row must belong to THIS order.
  if (orderId) query = query.eq("order_id", orderId);
  const { data } = await query.maybeSingle();
  return (data as PaymentRow | null) ?? null;
}

/**
 * Captures the PayPal order and verifies it completed for at least the
 * expected USD amount. If an earlier callback already captured and verified it
 * (but a later step failed), the capture is not repeated.
 */
async function captureAndVerify(supabase: Service, pay: PaymentRow, paypalOrderId: string) {
  if ((pay.raw_response as { captured?: boolean } | null)?.captured === true) return;

  const captured = await capturePaypalOrder(paypalOrderId);
  if (captured.status !== "COMPLETED") throw new Error("Payment was not completed");
  if (paypalCapturedUsd(captured) + 0.009 < Number(pay.amount)) {
    throw new Error("Paid amount is lower than expected");
  }

  await supabase
    .from("payments")
    .update({ raw_response: { ...(pay.raw_response ?? {}), captured: true, status: captured.status } })
    .eq("id", pay.id)
    .eq("status", "initiated");
}

async function advanceOrder(supabase: Service, orderId: string) {
  await supabase
    .from("orders")
    .update({ status: "pending_seller_acceptance" })
    .eq("id", orderId)
    .eq("status", "pending_payment");
}

async function handleOrderCallback(
  supabase: Service,
  paypalOrderId: string | null,
  orderId: string | null,
  siteUrl: string
) {
  if (!orderId || !paypalOrderId) {
    return NextResponse.redirect(`${siteUrl}/dashboard/orders?payment=error`);
  }

  // SECURITY: the PayPal order must be the one we created for THIS order.
  const pay = await loadPayment(supabase, paypalOrderId, orderId);
  if (!pay) {
    return NextResponse.redirect(`${siteUrl}/dashboard/orders?payment=error`);
  }

  // Already processed (refresh / retry): make sure the order moved on, then stop.
  if (pay.status === "held_escrow" || pay.status === "released") {
    await advanceOrder(supabase, orderId);
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=success`);
  }

  if (pay.status !== "initiated") {
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=error`);
  }

  try {
    await captureAndVerify(supabase, pay, paypalOrderId);

    // One-time gate: only the first callback flips initiated -> held_escrow.
    await supabase
      .from("payments")
      .update({ status: "held_escrow" })
      .eq("id", pay.id)
      .eq("status", "initiated");

    await advanceOrder(supabase, orderId);
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=success`);
  } catch {
    // Left as "initiated" on purpose: an uncertain error must not mark a
    // possibly-paid payment as failed. An admin can reconcile it.
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=error`);
  }
}

async function handleWalletTopupCallback(
  supabase: Service,
  paypalOrderId: string | null,
  siteUrl: string
) {
  if (!paypalOrderId) {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }

  // SECURITY: never trust user_id/amount from the query string — use the
  // payments row we wrote at initiation time.
  const pay = await loadPayment(supabase, paypalOrderId, null);
  if (!pay || !pay.payer_id || !pay.credit_amount_bdt) {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }

  if (pay.status === "released") {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
  }
  if (pay.status !== "initiated") {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }

  const amount = Number(pay.credit_amount_bdt);

  try {
    await captureAndVerify(supabase, pay, paypalOrderId);

    // One-time gate against double credit.
    const { data: claimed } = await supabase
      .from("payments")
      .update({ status: "released" })
      .eq("id", pay.id)
      .eq("status", "initiated")
      .select("id");

    if (!claimed || claimed.length === 0) {
      return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
    }

    const { error: creditError } = await supabase.rpc("adjust_wallet_balance", {
      p_user_id: pay.payer_id,
      p_delta: amount,
      p_type: "topup",
      p_notes: "Wallet top-up via PayPal",
      p_provider: "paypal",
      p_provider_txn_id: paypalOrderId,
    });

    if (creditError) {
      // Money was captured but the wallet was not credited: re-open the payment
      // so a retry of this same callback URL can credit it (no second capture).
      await supabase.from("payments").update({ status: "initiated" }).eq("id", pay.id);
      return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
    }

    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
  } catch {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }
}
