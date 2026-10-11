import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { executeBkashPayment } from "@/lib/bkash/client";

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
  const paymentID = url.searchParams.get("paymentID");
  const status = url.searchParams.get("status"); // success | failure | cancel
  const kind = url.searchParams.get("kind"); // "wallet_topup" | null (= order)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const supabase = createServiceClient();

  // NOTE: subscription plans were removed — there is no "kind=subscription" branch.
  if (kind === "wallet_topup") {
    return handleWalletTopupCallback(supabase, paymentID, status, siteUrl);
  }
  return handleOrderCallback(supabase, paymentID, url.searchParams.get("order_id"), status, siteUrl);
}

async function loadPayment(
  supabase: Service,
  paymentID: string,
  orderId: string | null
): Promise<PaymentRow | null> {
  let query = supabase
    .from("payments")
    .select("id, status, amount, payer_id, credit_amount_bdt, raw_response")
    .eq("provider", "bkash")
    .eq("provider_txn_id", paymentID);
  // For order payments the payment row must belong to THIS order.
  if (orderId) query = query.eq("order_id", orderId);
  const { data } = await query.maybeSingle();
  return (data as PaymentRow | null) ?? null;
}

/**
 * Asks bKash to execute the payment and verifies it really completed for at
 * least the expected BDT amount. If an earlier callback already executed and
 * verified it (but a later step failed), that result is reused instead of
 * calling bKash again (bKash rejects a second execute).
 */
async function executeAndVerify(
  supabase: Service,
  pay: PaymentRow,
  paymentID: string,
  expectedBdt: number
) {
  if ((pay.raw_response as { executed?: boolean } | null)?.executed === true) return;

  const result = await executeBkashPayment(paymentID);
  if (result.currency && result.currency !== "BDT") throw new Error("Unexpected currency");
  if (Number(result.amount) + 0.001 < expectedBdt) throw new Error("Paid amount is lower than expected");

  await supabase
    .from("payments")
    .update({ raw_response: { ...(result as unknown as Record<string, unknown>), executed: true } })
    .eq("id", pay.id)
    .eq("status", "initiated");
}

async function handleOrderCallback(
  supabase: Service,
  paymentID: string | null,
  orderId: string | null,
  status: string | null,
  siteUrl: string
) {
  if (!paymentID || !orderId) {
    return NextResponse.redirect(`${siteUrl}/dashboard/orders?payment=error`);
  }

  const pay = await loadPayment(supabase, paymentID, orderId);
  if (!pay) {
    return NextResponse.redirect(`${siteUrl}/dashboard/orders?payment=error`);
  }

  // Already processed (refresh / retry): make sure the order moved on, then stop.
  if (pay.status === "held_escrow" || pay.status === "released") {
    await advanceOrder(supabase, orderId);
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=success`);
  }

  if (status !== "success") {
    await supabase.from("payments").update({ status: "failed" }).eq("id", pay.id).eq("status", "initiated");
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=cancelled`);
  }

  if (pay.status !== "initiated") {
    return NextResponse.redirect(`${siteUrl}/dashboard/orders/${orderId}?payment=error`);
  }

  try {
    await executeAndVerify(supabase, pay, paymentID, Number(pay.amount));

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

async function advanceOrder(supabase: Service, orderId: string) {
  await supabase
    .from("orders")
    .update({ status: "pending_seller_acceptance" })
    .eq("id", orderId)
    .eq("status", "pending_payment");
}

async function handleWalletTopupCallback(
  supabase: Service,
  paymentID: string | null,
  status: string | null,
  siteUrl: string
) {
  if (!paymentID) {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }

  // SECURITY: user_id/amount in the URL are client-controlled. Only the
  // payments row we wrote at initiation is trusted.
  const pay = await loadPayment(supabase, paymentID, null);
  if (!pay || !pay.payer_id || !pay.credit_amount_bdt) {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }

  if (pay.status === "released") {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
  }

  if (status !== "success") {
    await supabase.from("payments").update({ status: "failed" }).eq("id", pay.id).eq("status", "initiated");
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=cancelled`);
  }

  if (pay.status !== "initiated") {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }

  const amount = Number(pay.credit_amount_bdt);

  try {
    await executeAndVerify(supabase, pay, paymentID, amount);

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

    // Atomic credit + ledger entry in one database function.
    const { error: creditError } = await supabase.rpc("adjust_wallet_balance", {
      p_user_id: pay.payer_id,
      p_delta: amount,
      p_type: "topup",
      p_notes: "Wallet top-up via bKash",
      p_provider: "bkash",
      p_provider_txn_id: paymentID,
    });

    if (creditError) {
      // Money was taken but the wallet was not credited: re-open the payment so
      // a retry of this same callback URL can credit it (bKash is not asked again).
      await supabase.from("payments").update({ status: "initiated" }).eq("id", pay.id);
      return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
    }

    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
  } catch {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }
}
