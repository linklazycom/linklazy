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
      .update({ status: "in_progress" })
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
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  const amount = Number(url.searchParams.get("amount")); // BDT amount credited to the wallet

  if (!paypalOrderId || !userId || !amount) {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }

  // Idempotency guard: if this payment was already credited, don't double-credit the wallet.
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("status")
    .eq("provider_txn_id", paypalOrderId)
    .single();

  if (existingPayment?.status === "released") {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
  }

  try {
    const captured = await capturePaypalOrder(paypalOrderId);
    if (captured.status !== "COMPLETED") throw new Error("Payment was not completed");

    await supabase.from("payments").update({ status: "released" }).eq("provider_txn_id", paypalOrderId);

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
      provider: "paypal",
      provider_txn_id: paypalOrderId,
      notes: "Wallet top-up via PayPal",
    });

    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=success`);
  } catch {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_txn_id", paypalOrderId);
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?wallet=error`);
  }
}
