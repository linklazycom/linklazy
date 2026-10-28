import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { capturePaypalOrder, paypalCapturedUsd } from "@/lib/paypal/client";
import { finishOrderPayment, finishWalletTopup } from "@/lib/paypal/complete";

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
    await finishOrderPayment(supabase, pay, orderId);
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=success`);
  }

  if (pay.status !== "initiated") {
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=error`);
  }

  try {
    await captureAndVerify(supabase, pay, paypalOrderId);

    // One-time gate: only the first caller flips initiated -> held_escrow.
    await finishOrderPayment(supabase, pay, orderId);
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

  try {
    await captureAndVerify(supabase, pay, paypalOrderId);
    const result = await finishWalletTopup(supabase, pay, paypalOrderId);
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=${result === "failed" ? "error" : "success"}`);
  } catch {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }
}
